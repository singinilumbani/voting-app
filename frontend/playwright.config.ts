import { defineConfig, devices } from "@playwright/test";

const appUrl =
  process.env.PLAYWRIGHT_APP_URL ?? "http://localhost:3000";
const apiBase =
  process.env.PLAYWRIGHT_API_BASE ?? "http://localhost:8787";
const startApp =
  process.env.PLAYWRIGHT_APP_URL === undefined ||
  appUrl === "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: appUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: startApp
    ? {
        command: "pnpm dev",
        url: appUrl,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_API_MODE: "direct",
          NEXT_PUBLIC_API_URL: apiBase,
          NEXT_PUBLIC_ENABLE_MOCKS: "false",
        },
      }
    : undefined,
});
