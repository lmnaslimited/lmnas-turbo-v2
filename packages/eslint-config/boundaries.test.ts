import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import path from "node:path";

const cwd = path.resolve(__dirname, "../..");

describe("eslint boundary rules", () => {
  it("fails direct REST fetches for pages/navigation/blogs from apps", async () => {
    const eslint = new ESLint({ cwd, overrideConfigFile: path.join(cwd, ".eslintrc.cjs") });
    const [result] = await eslint.lintText('fetch("/api/pages"); export default function Page(){ return null; }', {
      filePath: path.join(cwd, "apps/site/app/bad-rest/page.tsx")
    });

    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.messages.some((m) => m.message.includes("GraphQL clients"))).toBe(true);
  });

  it("fails direct axios imports from apps", async () => {
    const eslint = new ESLint({ cwd, overrideConfigFile: path.join(cwd, ".eslintrc.cjs") });
    const [result] = await eslint.lintText('import axios from "axios"; export default function Page(){ return null; }', {
      filePath: path.join(cwd, "apps/site/app/bad/page.tsx")
    });

    expect(result.errorCount).toBeGreaterThan(0);
  });
});
