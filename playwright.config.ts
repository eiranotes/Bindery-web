import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const macChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath = existsSync(macChrome) ? macChrome : undefined;

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3000",
    browserName: "chromium",
    launchOptions: executablePath ? { executablePath } : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
