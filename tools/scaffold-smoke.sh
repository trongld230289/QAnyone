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
mkdir -p tests pages fixtures helpers playwright/.auth
cp "$T/playwright.config.ts" ./playwright.config.ts
cp "$T/auth.setup.ts" tests/auth.setup.ts
cp "$T/base.page.ts" pages/base.page.ts
cp "$T/login.form.page.ts" pages/login.page.ts
cp "$T/page.template.ts" pages/example.page.ts
cp "$T/pages.fixture.ts" fixtures/pages.fixture.ts
cp "$T/env.ts" helpers/env.ts
cp "$T/totp.ts" helpers/totp.ts
cp "$T/gitignore" .gitignore
printf 'BASE_URL=https://demo.playwright.dev\nAUTH_REQUIRED=false\n' > .env
cat > tsconfig.json <<'EOF'
{ "compilerOptions": { "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler", "strict": true, "noEmit": true, "skipLibCheck": true, "types": ["node"] } }
EOF
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
test -f playwright/.auth/user.json && echo "storage state written (empty, no auth)"
echo "scaffold-smoke OK"
