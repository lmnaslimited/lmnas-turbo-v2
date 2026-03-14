import { defineConfig } from "playwright/test";
import { loadProjectEnv } from "./apps/site/app/lib/env";

loadProjectEnv({
  mode: process.env.NODE_ENV ?? "test"
});

const configuredPort = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? "3000", 10);
const port = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 3000;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const skipManagedWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1";

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
  ...(skipManagedWebServer
    ? {}
    : {
        webServer: {
          command: `pnpm --filter @lmnas/site exec next dev --hostname 127.0.0.1 --port ${port}`,
          url: baseURL,
          timeout: 240_000,
          reuseExistingServer: true
        }
      })
});
