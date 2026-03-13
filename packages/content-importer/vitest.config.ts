import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@lmnas/blocks/Hero/schema.js",
        replacement: path.resolve(__dirname, "../blocks/Hero/schema.ts")
      },
      {
        find: "@lmnas/blocks/FAQ/schema.js",
        replacement: path.resolve(__dirname, "../blocks/FAQ/schema.ts")
      },
      {
        find: "@lmnas/contracts",
        replacement: path.resolve(__dirname, "../contracts/src/index.ts")
      },
      {
        find: "@lmnas/block-registry",
        replacement: path.resolve(__dirname, "../block-registry/src/index.ts")
      },
      {
        find: "@lmnas/blocks",
        replacement: path.resolve(__dirname, "../blocks/index.ts")
      }
    ]
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"]
  }
});
