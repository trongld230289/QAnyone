import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

/** Azure AD / Entra ID login (login.microsoftonline.com). Locators are [FROM TEMPLATE]. */
export class LoginPage extends BasePage {
  readonly path = "/"; // the app redirects to Microsoft login
  readonly loginForm: Locator;
  readonly email: Locator;
  readonly next: Locator;
  readonly password: Locator;
  readonly signIn: Locator;
  readonly totp: Locator;
  readonly verify: Locator;
  readonly staySignedInYes: Locator;

  constructor(page: Page) {
    super(page);
    this.loginForm = page.locator("form[name=f1]");
    this.email = page.locator("input[name=loginfmt]");
    this.next = page.getByRole("button", { name: "Next" });
    this.password = page.locator("input[name=passwd]");
    this.signIn = page.getByRole("button", { name: "Sign in" });
    this.totp = page.locator("input[name=otc]");
    this.verify = page.getByRole("button", { name: "Verify" });
    this.staySignedInYes = page.getByRole("button", { name: "Yes" });
  }

  async login(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.next.click();
    await this.password.fill(password);
    await this.signIn.click();
  }

  async enterTotp(code: string): Promise<void> {
    await this.totp.fill(code);
    await this.verify.click();
    if (await this.staySignedInYes.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await this.staySignedInYes.click();
    }
  }
}
