import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

/** Standard username (or email) + password login. SETUP replaces the locators with ones discovered through BROWSER. */
export class LoginPage extends BasePage {
  readonly path = "/login"; // SETUP: confirm the real login route
  /** While the URL matches this, the user is still logged out. SETUP: confirm it. */
  readonly loggedOutUrl = /\/login/;
  readonly loginForm: Locator;
  readonly username: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly totp: Locator;

  constructor(page: Page) {
    super(page);
    // SETUP replaces these with [FROM MCP] locators.
    this.loginForm = page.getByRole("form");
    this.username = page.getByLabel("Username"); // or "Email" — SETUP picks the real label
    this.password = page.getByLabel("Password");
    this.submit = page.getByRole("button", { name: "Sign in" });
    this.totp = page.getByLabel("Verification code");
  }

  async login(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.submit.click();
  }

  async enterTotp(code: string): Promise<void> {
    await this.totp.fill(code);
    await this.submit.click();
  }
}
