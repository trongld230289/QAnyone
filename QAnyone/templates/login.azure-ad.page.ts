import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

/** Azure AD / Entra ID login (login.microsoftonline.com). Locators are [FROM TEMPLATE]. */
export class LoginPage extends BasePage {
  readonly path = "/"; // the app redirects to Microsoft login
  /** While the URL matches this, the user is still logged out. */
  readonly loggedOutUrl = /login\.microsoftonline\.com/;
  readonly loginForm: Locator;
  readonly username: Locator;
  readonly next: Locator;
  readonly password: Locator;
  readonly signIn: Locator;
  readonly totp: Locator;
  readonly verify: Locator;
  readonly staySignedInYes: Locator;

  constructor(page: Page) {
    super(page);
    this.loginForm = page.locator("form[name=f1]");
    this.username = page.locator("input[name=loginfmt]");
    this.next = page.getByRole("button", { name: "Next" });
    this.password = page.locator("input[name=passwd]");
    this.signIn = page.getByRole("button", { name: "Sign in" });
    this.totp = page.locator("input[name=otc]");
    this.verify = page.getByRole("button", { name: "Verify" });
    this.staySignedInYes = page.getByRole("button", { name: "Yes" });
  }

  async login(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.next.click();
    await this.password.fill(password);
    await this.signIn.click();
    await this.acceptStaySignedIn();
  }

  async enterTotp(code: string): Promise<void> {
    await this.useVerificationCode();
    await this.totp.fill(code);
    await this.verify.click();
    await this.acceptStaySignedIn();
  }

  /** Tenants whose default MFA is the Authenticator push show "Approve sign in request" first:
   *  switch to the code prompt. Both links are absent when the code prompt is already shown. */
  private async useVerificationCode(): Promise<void> {
    const codeShown = await this.totp.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false);
    if (codeShown) return;
    await this.page
      .getByRole("link", { name: /can't use my Microsoft Authenticator|sign in another way/i })
      .click({ timeout: 5_000 })
      .catch(() => undefined);
    await this.page.getByText(/use a verification code/i).first().click({ timeout: 5_000 }).catch(() => undefined);
  }

  /** "Stay signed in?" appears after sign-in or after MFA; absent on some tenants. */
  private async acceptStaySignedIn(): Promise<void> {
    await this.staySignedInYes
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => this.staySignedInYes.click())
      .catch(() => undefined);
  }
}
