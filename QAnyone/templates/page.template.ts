import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

/** <PageName> — <route>. Locators come from pom-registry/<feature>.md; keep the tags in sync. */
export class ExamplePage extends BasePage {
  readonly path = "/example";
  readonly searchBox: Locator; // [FROM MCP]
  readonly searchButton: Locator; // [FROM MCP]

  constructor(page: Page) {
    super(page);
    this.searchBox = page.getByRole("searchbox", { name: "Search" });
    this.searchButton = page.getByRole("button", { name: "Search" });
  }

  async search(keyword: string): Promise<void> {
    await this.searchBox.fill(keyword);
    await this.searchButton.click();
  }

  /** Row-scoped locator for elements repeated per row. */
  row(name: string): Locator {
    return this.page.getByRole("row", { name });
  }
}
