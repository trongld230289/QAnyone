import { test, expect } from "@playwright/test";
const FORM = new URL("../QAnyone/setup/index.html", import.meta.url).href;

test("conditional questions hide and show", async ({ page }) => {
  await page.goto(FORM);
  await expect(page.locator("#q-two-fa")).toBeHidden();
  await page.locator("input[name=auth][value=form]").check();
  await expect(page.locator("#q-two-fa")).toBeVisible();
  await expect(page.locator("#q-totp")).toBeHidden();
  await page.locator("input[name=two_fa][value=totp]").check();
  await expect(page.locator("#q-totp")).toBeVisible();
  await expect(page.locator("#q-ado")).toBeHidden();
  await page.locator("input[name=sources][value=ado]").check();
  await expect(page.locator("#q-ado")).toBeVisible();
});

test("generate produces valid config markdown and escapes YAML", async ({ page }) => {
  await page.goto(FORM);
  await page.fill("#base_url", "https://app.example.com/login?x=1#top");
  await page.locator("input[name=auth][value=none]").check();
  await page.locator("input[name=sources][value=md]").check();
  await page.locator("input[name=browsers][value=firefox]").check();
  await page.locator("input[name=test_data][value=existing]").check();
  await page.locator("input[name=language][value=vi]").check();
  await page.fill("#notes", 'App: SPA with "quotes" and colons: yes');
  await page.click("#add-qa");
  await page.fill(".qa-q >> nth=0", "Which env?");
  await page.fill(".qa-a >> nth=0", "QA env: shared");
  await page.click("#generate");
  const out = await page.inputValue("#output");
  expect(out).toMatch(/^---\nbase_url: "https:\/\/app\.example\.com\/login\?x=1#top"\n/);
  expect(out).toContain("auth: none\n");
  expect(out).not.toContain("two_fa:");
  expect(out).toContain("sources: [md]\n");
  expect(out).toContain("browsers: [chromium, firefox]\n");
  expect(out).toContain("language: vi\n");
  expect(out).toContain("\n## Notes\n");
  expect(out).toContain('App: SPA with "quotes" and colons: yes');
  expect(out).toContain("**Which env?** QA env: shared");
});

test("prefills from query string", async ({ page }) => {
  await page.goto(
    FORM +
      "?baseUrl=https://x.io&auth=azure-ad&twoFa=totp&sources=ado,md&adoOrg=https://dev.azure.com/o&adoProject=P&browsers=chromium,webkit&testData=seed&language=en",
  );
  await expect(page.locator("#base_url")).toHaveValue("https://x.io");
  await expect(page.locator("input[name=auth][value=azure-ad]")).toBeChecked();
  await expect(page.locator("input[name=two_fa][value=totp]")).toBeChecked();
  await expect(page.locator("#q-totp")).toBeVisible();
  await expect(page.locator("input[name=sources][value=ado]")).toBeChecked();
  await expect(page.locator("#ado_org")).toHaveValue("https://dev.azure.com/o");
  await expect(page.locator("input[name=browsers][value=webkit]")).toBeChecked();
  await page.click("#generate");
  expect(await page.inputValue("#output")).toContain('ado_project: "P"\n');
});

test("has no external resources", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("file:")) external.push(r.url());
  });
  await page.goto(FORM);
  expect(external).toEqual([]);
});
