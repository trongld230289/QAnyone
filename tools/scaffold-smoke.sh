#!/usr/bin/env bash
# Builds a real project from the templates and runs a smoke spec against the public TodoMVC demo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$ROOT/QAnyone/templates"
D="$(mktemp -d)"
echo "scaffold in $D"
cd "$D"
npm init -y >/dev/null
npm i -D @playwright/test@^1.50.0 @types/node dotenv tsx typescript >/dev/null 2>&1
printf -- '---
base_url: "https://demo.playwright.dev"
auth: none
sources: [md, codegen]
browsers: [chromium]
language: en
---
' > qanyone.config.md
node "$ROOT/QAnyone/setup/scaffold.mjs" .
# TRACE=on so the passing test is traced too (checked at the end)
sed -i.bak 's/^TRACE=.*/TRACE=on/' .env && rm -f .env.bak
cat > tests/smoke.spec.ts <<'EOF'
import { test, expect } from "../fixtures/pages.fixture";
test.describe("SMOKE todomvc", { tag: ["@smoke"] }, () => {
  test("adds a todo", async ({ page }) => {
    await test.step("1. [Pre] Open TodoMVC", async () => { await page.goto("/todomvc"); });
    await test.step("2. Fill \"buy milk\" into \"What needs to be done?\", press Enter", async () => {
      await page.getByPlaceholder("What needs to be done?").fill("buy milk");
      await page.getByPlaceholder("What needs to be done?").press("Enter");
    });
    await test.step("3. Verify todo list", async () => {
      await expect(page.getByTestId("todo-title")).toHaveText(["buy milk"]);
    });
  });
});
EOF
npx tsc -p tsconfig.json
npx playwright test --project=chromium
# A failing test must leave a trace for the self-heal / blocked report (plan Review: I1).
cat > tests/fail.spec.ts <<'EOF2'
import { test, expect } from "../fixtures/pages.fixture";
test("deliberate failure leaves a trace", async ({ page }) => {
  await page.goto("/todomvc");
  await expect(page.getByRole("button", { name: "does not exist" })).toBeVisible({ timeout: 1000 });
});
EOF2
npx playwright test --project=chromium tests/fail.spec.ts >/dev/null 2>&1 || true
find test-results -name "trace.zip" | grep -q . && echo "trace.zip present" || { echo "NO trace"; exit 1; }
# TRACE=on in .env must also trace the passing smoke test (run flags are read from .env).
[ "$(find test-results -name trace.zip | wc -l)" -ge 2 ] && echo "TRACE=on flag honoured (passing test traced too)" || { echo "TRACE=on flag ignored"; exit 1; }
test -f playwright/.auth/user.json && echo "storage state written (empty, no auth)"
echo "scaffold-smoke OK"
