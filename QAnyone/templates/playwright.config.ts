import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const authRequired = (process.env.AUTH_REQUIRED ?? "false") === "true";
const STORAGE = "playwright/.auth/user.json";

// Run flags — change them in .env, not here (see .env.example for the allowed values).
const flag = (key: string, fallback: string): string => process.env[key]?.trim() || fallback;
// `--headed` on the command line counts as HEADLESS=false, so that window is maximised too
// (set in the env so the test workers see it as well).
if (process.argv.includes("--headed")) process.env.HEADLESS = "false";
// HEADLESS: false (default) = a browser window you can watch; true when the CI variable is set.
const headless = flag("HEADLESS", process.env.CI ? "true" : "false") !== "false";
const trace = flag("TRACE", "retain-on-failure") as "on" | "off" | "retain-on-failure" | "on-first-retry";
const video = flag("VIDEO", "retain-on-failure") as "on" | "off" | "retain-on-failure";
const screenshot = flag("SCREENSHOT", "only-on-failure") as "on" | "off" | "only-on-failure";
// VIEWPORT: "max" (default) = window maximised, page fills it, or "<width>x<height>"
// (headed Chromium only; headless has no window, so "max" falls back to 1280x720).
// Spread `...win` after `devices[...]` so it wins over the device size.
const viewport = flag("VIEWPORT", "max");
const size = /^(\d+)x(\d+)$/.exec(viewport);
const win = viewport === "max" && !headless
  ? { viewport: null, deviceScaleFactor: undefined, launchOptions: { args: ["--start-maximized"] } }
  : { viewport: { width: Number(size?.[1] ?? 1280), height: Number(size?.[2] ?? 720) } };

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
    ...win,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...win, storageState: authRequired ? STORAGE : undefined },
      dependencies: ["setup"],
    },
    // SETUP uncomments these when the config lists the browser:
    // { name: "firefox", use: { ...devices["Desktop Firefox"], ...win, storageState: authRequired ? STORAGE : undefined }, dependencies: ["setup"] },
    // { name: "webkit",  use: { ...devices["Desktop Safari"],  ...win, storageState: authRequired ? STORAGE : undefined }, dependencies: ["setup"] },
  ],
});
