import fs from "node:fs";
import path from "node:path";

function loadMonorepoEnv() {
  const rootDir = path.resolve(process.cwd(), "../..");
  const envFiles = [".env", ".env.local"];

  for (const file of envFiles) {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    content.split(/\r?\n/g).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx <= 0) return;

      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  }
}

// Ensure monorepo env is injected before Next.js fully boots
loadMonorepoEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@lmnas/blocks",
    "@lmnas/block-registry",
    "@lmnas/contracts",
    "@lmnas/analytics",
    "@lmnas/integrations",
    "@lmnas/layouts",
    "@lmnas/renderer",
    "@lmnas/seo-engine",
    "@lmnas/testkit"
  ]
};

export default nextConfig;
