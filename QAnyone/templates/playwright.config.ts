import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const authRequired = (process.env.AUTH_REQUIRED ?? "false") === "true";
const STORAGE = "playwright/.auth/user.json";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: authRequired ? STORAGE : undefined },
      dependencies: ["setup"],
    },
    // SETUP uncomments these when the config lists the browser:
    // { name: "firefox", use: { ...devices["Desktop Firefox"], storageState: authRequired ? STORAGE : undefined }, dependencies: ["setup"] },
    // { name: "webkit",  use: { ...devices["Desktop Safari"],  storageState: authRequired ? STORAGE : undefined }, dependencies: ["setup"] },
  ],
});
