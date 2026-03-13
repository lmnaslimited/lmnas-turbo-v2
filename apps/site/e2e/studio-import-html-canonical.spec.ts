import { expect, test } from "playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const HTML_FIXTURE_PATH = path.resolve(process.cwd(), "docs/testing-artifacts/code.html");
const EVIDENCE_DIR = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h008");

type ProcessPayload = {
  ok: boolean;
  persistence?: {
    source?: "strapi" | "fallback";
    schemaSource?: "canonical" | "legacy" | "fallback";
    proposalsPersisted?: number;
    warnings?: string[];
    proposalBlocks?: Array<{ proposalId: string; blockKey: string }>;
  };
};

type PublishPayload = {
  ok: boolean;
  result?: {
    applied: boolean;
    warnings: Array<{ severity: string; message: string }>;
  };
  source?: "strapi" | "fallback";
};

test.describe("studio import html canonical flow", () => {
  test("imports HTML artifact and persists canonical blocks visible in Blocks page after reload", async ({ page }) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    const htmlArtifact = await readFile(HTML_FIXTURE_PATH, "utf8");

    const resetResponse = await page.request.post("/api/platform/studio/reset");
    expect(resetResponse.ok()).toBe(true);
    const resetPayload = await resetResponse.json();

    await page.goto("/platform/onboarding/import");
    await expect(page.getByRole("heading", { name: "Import Content" })).toBeVisible();

    await page.getByRole("button", { name: "HTML" }).first().click();
    await page.getByTestId("import-source-input").fill(htmlArtifact);
    const processResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === "POST" && response.url().includes("/api/platform/studio/import/process");
    });
    await page.getByTestId("import-process-source").click();
    const processApiResponse = await processResponsePromise;
    const processPayload = (await processApiResponse.json()) as ProcessPayload;

    await expect(page.getByText(/Persisted \d+ draft canonical block\(s\)/)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("article").first()).toBeVisible();
    await expect(page.getByTestId("import-source-preview")).toBeVisible();
    await expect(page.getByTestId("import-target-preview")).toBeVisible();
    await expect(page.getByText(/Invalid key blockKey/)).toHaveCount(0);
    await expect(page.getByText(/local fallback store/i)).toHaveCount(0);

    expect(processPayload.ok).toBe(true);
    expect(processPayload.persistence?.source).toBe("strapi");
    expect(processPayload.persistence?.schemaSource).toBe("canonical");
    expect(processPayload.persistence?.proposalsPersisted ?? 0).toBeGreaterThan(0);
    expect(processPayload.persistence?.warnings ?? []).toEqual([]);

    const persistedBlockKeys = (processPayload.persistence?.proposalBlocks ?? []).map(
      (entry: { proposalId: string; blockKey: string }) => entry.blockKey
    );

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "tv-e2e-08-import-html-success.png"),
      fullPage: true
    });

    await page.getByRole("button", { name: "As Blocks" }).click();
    const publishResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === "POST" && response.url().includes("/api/platform/studio/blocks/publish");
    });
    await page.getByTestId("import-publish-selected").click();
    const publishApiResponse = await publishResponsePromise;
    const publishPayload = (await publishApiResponse.json()) as PublishPayload;
    await expect(page.getByText(/Draft page created:/)).toHaveCount(0);

    expect(publishPayload.ok).toBe(true);
    expect(publishPayload.result?.applied).toBe(true);
    expect(publishPayload.source).toBe("strapi");

    const canonicalBlocksResponse = await page.request.get("/api/platform/studio/blocks?search=import-source");
    expect(canonicalBlocksResponse.ok()).toBe(true);
    const canonicalBlocksPayload = (await canonicalBlocksResponse.json()) as {
      ok: boolean;
      source?: "strapi" | "fallback";
      schemaSource?: "canonical" | "legacy" | "fallback";
      data?: Array<{ key: string }>;
    };

    expect(canonicalBlocksPayload.ok).toBe(true);
    expect(canonicalBlocksPayload.source).toBe("strapi");
    expect(canonicalBlocksPayload.schemaSource).toBe("canonical");
    expect(Array.isArray(canonicalBlocksPayload.data)).toBe(true);
    expect((canonicalBlocksPayload.data ?? []).length).toBeGreaterThan(0);

    await page.goto("/platform/onboarding/blocks");
    await expect(page.getByRole("heading", { name: "Reusable Blocks" })).toBeVisible();
    await expect(page.getByText(/requires canonical studio-blocks/i)).toHaveCount(0);

    const assertionKey = persistedBlockKeys[0] ?? canonicalBlocksPayload.data?.[0]?.key;
    expect(assertionKey).toBeTruthy();
    await expect(page.getByText(assertionKey as string, { exact: false })).toBeVisible();

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "tv-e2e-08-blocks-after-import.png"),
      fullPage: true
    });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Reusable Blocks" })).toBeVisible();
    await expect(page.getByText(assertionKey as string, { exact: false })).toBeVisible();

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "tv-e2e-08-blocks-after-reload.png"),
      fullPage: true
    });

    await writeFile(
      path.join(EVIDENCE_DIR, "tv-e2e-08-html-import-log.json"),
      JSON.stringify(
        {
          fixturePath: HTML_FIXTURE_PATH,
          resetPayload,
          processPayload,
          publishPayload,
          persistedBlockKeys,
          canonicalBlocksSummary: {
            source: canonicalBlocksPayload.source,
            schemaSource: canonicalBlocksPayload.schemaSource,
            count: canonicalBlocksPayload.data?.length ?? 0,
            keys: (canonicalBlocksPayload.data ?? []).map((entry) => entry.key)
          }
        },
        null,
        2
      ),
      "utf8"
    );
  });
});
