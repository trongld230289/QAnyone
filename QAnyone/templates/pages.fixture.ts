import { test as base, expect } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
// PAGES-IMPORT (the pipeline adds: import { JobsPage } from "../pages/jobs.page";)

type Pages = {
  loginPage: LoginPage;
  // PAGES-TYPE (the pipeline adds: jobsPage: JobsPage;)
};

export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  // PAGES-FIXTURE (the pipeline adds: jobsPage: async ({ page }, use) => { await use(new JobsPage(page)); },)
});

export { expect };
