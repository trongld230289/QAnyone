import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /form\.spec\.ts/,
  use: { headless: true },
  reporter: [["list"]],
});
