import { expect, test } from "playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function createZipBuffer(entries: Array<{ fileName: string; content: string }>): Buffer {
  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.fileName, "utf8");
    const dataBuffer = Buffer.from(entry.content, "utf8");
    const compressedSize = dataBuffer.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(compressedSize, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localRecord = Buffer.concat([localHeader, nameBuffer, dataBuffer]);
    localRecords.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(compressedSize, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    const centralRecord = Buffer.concat([centralHeader, nameBuffer]);
    centralRecords.push(centralRecord);
    localOffset += localRecord.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const centralDirectoryOffset = localOffset;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralDirectoryOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localRecords, centralDirectory, eocd]);
}

async function createStitchZipFixture(name: string, html: string): Promise<string> {
  const zipBuffer = createZipBuffer([
    {
      fileName: "index.html",
      content: html
    }
  ]);

  const fixtureDir = path.join(os.tmpdir(), "lmnas-playwright-fixtures");
  await mkdir(fixtureDir, { recursive: true });
  const fixturePath = path.join(fixtureDir, name);
  await writeFile(fixturePath, zipBuffer);
  return fixturePath;
}

test.describe("studio import flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post("/api/platform/studio/reset");
  });

  test("processes Stitch ZIP and renders/persists proposed blocks", async ({ page }) => {
    const zipPath = await createStitchZipFixture(
      `stitch-import-${Date.now()}.zip`,
      "<!doctype html><html><body><section class='hero'><h1>Scale your business faster than ever.</h1><p>Import flow validation.</p><a href='/signup'>Get Started</a></section><section class='faq'><h2>FAQ</h2><p>Answers.</p></section></body></html>"
    );

    await page.goto("/platform/onboarding/import");
    await expect(page.getByRole("heading", { name: "Import Content" })).toBeVisible();

    await page.getByTestId("import-stitch-zip-input").setInputFiles(zipPath);
    await page.getByTestId("import-process-source").click();

    await expect(page.getByText(/Persisted .* draft canonical block\(s\)/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("import-source-preview")).toBeVisible();
    await expect(page.getByTestId("import-target-preview")).toBeVisible();

    const proposalCards = page.locator("article");
    await expect(proposalCards.first()).toBeVisible();

    const blocksResponse = await page.request.get("/api/platform/studio/blocks?search=import-source");
    expect(blocksResponse.ok()).toBe(true);
    const blocksPayload = (await blocksResponse.json()) as {
      ok: boolean;
      data?: Array<{ sourceType?: string; key?: string; sourceRef?: string }>;
    };
    expect(blocksPayload.ok).toBe(true);
    expect(Array.isArray(blocksPayload.data)).toBe(true);
    expect(
      (blocksPayload.data ?? []).some(
        (block) => (block.key ?? "").includes("import-source") || (block.sourceRef ?? "").includes("stitch")
      )
    ).toBe(true);
  });

  test("imports as page using canonical imported block keys", async ({ page }) => {
    const zipPath = await createStitchZipFixture(
      `stitch-page-import-${Date.now()}.zip`,
      "<!doctype html><html><body><section class='hero'><h1>Page Import Hero</h1><p>End-to-end import as page.</p></section><section class='cta'><a href='/contact'>Contact Us</a></section></body></html>"
    );

    await page.goto("/platform/onboarding/import");
    await page.getByTestId("import-stitch-zip-input").setInputFiles(zipPath);
    await page.getByTestId("import-process-source").click();
    await expect(page.getByText(/Persisted .* draft canonical block\(s\)/)).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "As Page" }).first().click();
    await page.getByTestId("import-publish-selected").click();
    const pageCreatedBanner = page.getByText(/Draft page created:/);
    await expect(pageCreatedBanner).toBeVisible({ timeout: 30_000 });
    const pageCreatedText = await pageCreatedBanner.textContent();
    expect(pageCreatedText ?? "").toContain("Draft page created:");

    const pagesResponse = await page.request.get("/api/platform/studio/pages");
    expect(pagesResponse.ok()).toBe(true);
    const pagesPayload = (await pagesResponse.json()) as {
      ok: boolean;
      data?: Array<{
        slug: string;
        blockOrder: string[];
        themeKey?: string;
      }>;
    };

    expect(pagesPayload.ok).toBe(true);
    expect(Array.isArray(pagesPayload.data)).toBe(true);
    expect((pagesPayload.data ?? []).length).toBeGreaterThan(0);
  });
});
