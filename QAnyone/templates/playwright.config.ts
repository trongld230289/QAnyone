import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const authRequired = (process.env.AUTH_REQUIRED ?? "false") === "true";
const STORAGE = "playwright/.auth/user.json";

// Run flags — change them in .env, not here (see .env.example for the allowed values).
const flag = (key: string, fallback: string): string => process.env[key]?.trim() || fallback;
const headless = flag("HEADLESS", "true") !== "false";
const trace = flag("TRACE", "retain-on-failure") as "on" | "off" | "retain-on-failure" | "on-first-retry";
const video = flag("VIDEO", "retain-on-failure") as "on" | "off" | "retain-on-failure";
const screenshot = flag("SCREENSHOT", "only-on-failure") as "on" | "off" | "only-on-failure";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL,
    headless,
    trace,
    video,
    screenshot,
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
