import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");

describe("analytics adoption", () => {
  it("apps/site references @lmnas/analytics", () => {
    const sitePage = readFileSync(path.join(root, "apps/site/app/page.tsx"), "utf8");
    expect(sitePage).toContain("@lmnas/analytics");
  });

  it("apps/blogs references @lmnas/analytics", () => {
    const blogsPage = readFileSync(path.join(root, "apps/blogs/app/page.tsx"), "utf8");
    expect(blogsPage).toContain("@lmnas/analytics");
  });
});
