import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

/** Standard email/password login. SETUP replaces the locators with ones discovered through BROWSER. */
export class LoginPage extends BasePage {
  readonly path = "/login"; // SETUP: confirm the real login route
  readonly loginForm: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly totp: Locator;

  constructor(page: Page) {
    super(page);
    // SETUP replaces these with [FROM MCP] locators.
    this.loginForm = page.getByRole("form");
    this.email = page.getByLabel("Email");
    this.password = page.getByLabel("Password");
    this.submit = page.getByRole("button", { name: "Sign in" });
    this.totp = page.getByLabel("Verification code");
  }

  async login(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  async enterTotp(code: string): Promise<void> {
    await this.totp.fill(code);
    await this.submit.click();
  }
}
