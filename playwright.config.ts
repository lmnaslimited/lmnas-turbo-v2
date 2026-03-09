import { defineConfig } from "playwright/test";
import { loadProjectEnv } from "./apps/site/app/lib/env";

loadProjectEnv({
  mode: process.env.NODE_ENV ?? "test"
});

const baseURL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./apps/site/e2e",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.015
    }
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command:
      "pnpm --filter @lmnas/site exec next dev --hostname 127.0.0.1 --port 3000",
    url: baseURL,
    timeout: 240_000,
    reuseExistingServer: true
  }
});
