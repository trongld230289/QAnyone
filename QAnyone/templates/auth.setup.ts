import { test as setup, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { LoginPage } from "../pages/login.page";
import { requireEnv, authRequired } from "../helpers/env";
import { generateTotp } from "../helpers/totp";

const STORAGE = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  mkdirSync("playwright/.auth", { recursive: true });
  if (!authRequired) {
    writeFileSync(STORAGE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }
  const login = new LoginPage(page);
  await login.goto();
  await login.login(requireEnv("LOGIN_EMAIL"), requireEnv("LOGIN_PASSWORD"));
  if (process.env.TOTP_SECRET) await login.enterTotp(generateTotp(process.env.TOTP_SECRET));
  // Landed inside the app: the login form must be gone. SETUP replaces this with a stronger
  // app-specific check (an element that only exists after login) discovered through BROWSER.
  await expect(login.loginForm).toBeHidden({ timeout: 30_000 });
  await page.context().storageState({ path: STORAGE });
});
