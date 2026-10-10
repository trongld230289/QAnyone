import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

/** Google sign-in (accounts.google.com). Locators are [FROM TEMPLATE]. */
export class LoginPage extends BasePage {
  readonly path = "/"; // the app redirects to Google
  /** While the URL matches this, the user is still logged out. */
  readonly loggedOutUrl = /accounts\.google\.com/;
  readonly loginForm: Locator;
  readonly username: Locator;
  readonly next: Locator;
  readonly password: Locator;
  readonly totp: Locator;

  constructor(page: Page) {
    super(page);
    this.loginForm = page.locator("form");
    this.username = page.locator("input[type=email]");
    this.next = page.getByRole("button", { name: "Next" });
    this.password = page.locator("input[type=password]");
    this.totp = page.locator("input[type=tel]");
  }

  async login(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.next.click();
    await this.password.fill(password);
    await this.next.click();
  }

  async enterTotp(code: string): Promise<void> {
    await this.totp.fill(code);
    await this.next.click();
  }
}
