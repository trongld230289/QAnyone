import { test as setup, expect } from "@playwright/test";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { LoginPage } from "../pages/login.page";
import { requireEnv, authRequired } from "../helpers/env";
import { generateTotp } from "../helpers/totp";

const STORAGE = "playwright/.auth/user.json";

setup("authenticate", async ({ page, browser }) => {
  mkdirSync("playwright/.auth", { recursive: true });
  if (!authRequired) {
    writeFileSync(STORAGE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }
  const login = new LoginPage(page);
  // Reuse the saved session while it is still valid: no login and no MFA prompt per run.
  // Delete playwright/.auth/user.json to force a fresh login.
  if (existsSync(STORAGE) && statSync(STORAGE).size > 100) {
    const context = await browser.newContext({ storageState: STORAGE });
    const probe = await context.newPage();
    await probe.goto("/");
    await probe.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    const stillSignedIn = !login.loggedOutUrl.test(probe.url());
    await context.close();
    if (stillSignedIn) return;
  }
  await login.goto();
  await login.login(requireEnv("LOGIN_USERNAME"), requireEnv("LOGIN_PASSWORD"));
  if (process.env.TOTP_SECRET) await login.enterTotp(generateTotp(process.env.TOTP_SECRET));
  // Landed inside the app: we must have left the login URL. SETUP adds a stronger app-specific
  // check (an element that only exists after login) discovered through BROWSER.
  await expect(page).not.toHaveURL(login.loggedOutUrl, { timeout: 30_000 });
  await page.context().storageState({ path: STORAGE });
});
