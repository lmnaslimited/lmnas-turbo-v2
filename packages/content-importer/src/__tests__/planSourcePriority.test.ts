import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createImportPlan } from "../index.js";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "content-plan-source-priority-"));
  tempDirs.push(dir);
  return dir;
}

describe("createImportPlan source precedence", () => {
  it("uses provided html input directly even when Strapi env vars are not set", async () => {
    const dir = await createTempDir();
    const htmlPath = path.join(dir, "about.html");
    await writeFile(
      htmlPath,
      "<html><head><title>About HTML Title</title></head><body><h2>About From HTML</h2><p>Subheading</p></body></html>",
      "utf8"
    );

    const plan = await createImportPlan({
      slug: "about",
      locale: "en",
      html: htmlPath
    });

    expect(plan.page.slug).toBe("about");
    expect(plan.page.sourceUrl).toBe(htmlPath);
    expect(plan.blocks[0]?.heading).toBe("About From HTML");
  });

  it("uses provided url input directly and does not require Strapi lookup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          "<html><head><title>URL Title</title></head><body><h1>Heading From URL</h1><p>Subheading</p></body></html>",
          {
            status: 200,
            headers: { "content-type": "text/html" }
          }
        );
      })
    );

    const plan = await createImportPlan({
      slug: "about",
      locale: "en",
      url: "https://example.com/about"
    });

    expect(plan.page.slug).toBe("about");
    expect(plan.page.sourceUrl).toBe("https://example.com/about");
    expect(plan.blocks[0]?.heading).toBe("Heading From URL");
  });
});
