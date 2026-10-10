# SETUP

Decide the branch first, silently:
```
no playwright.config.ts                        → A. Scaffold
playwright.config.ts, no QANYONE_STATE.md      → B. Onboard
QANYONE_STATE.md exists                        → ASK: "Resume where I stopped" / "Rescan the project" / "Show STATUS"
```

## A. Scaffold (empty repo)
1. Say: "Open `QAnyone/setup/index.html` in your browser, answer the questions, click
   **Generate**, copy the text and paste it here." Stop and wait for the paste.
2. WRITE the pasted text to `qanyone.config.md`. From here on, no questions.
3. Build the project from `qanyone.config.md` (`T` = `QAnyone/templates/`):
   - RUN `npm init -y` · `npm i -D @playwright/test dotenv tsx typescript @types/node` ·
     `npx playwright install <browsers from config>`
   - WRITE `playwright.config.ts` from `T/playwright.config.ts`; uncomment the firefox/webkit
     projects listed in `browsers`.
   - WRITE `tsconfig.json`: `{ "compilerOptions": { "target": "ES2022", "module": "ESNext",
     "moduleResolution": "Bundler", "strict": true, "noEmit": true, "skipLibCheck": true,
     "types": ["node"] }, "exclude": ["node_modules", "QAnyone"] }` (templates must not be compiled in place).
   - Copy `T/base.page.ts → pages/`, `T/page.template.ts → pages/` (kept as the pattern for
     new pages), `T/pages.fixture.ts → fixtures/`, `T/env.ts → helpers/`, `T/totp.ts → helpers/`
     (always; auth.setup.ts imports it), `T/auth.setup.ts → tests/`, `T/gitignore → .gitignore`,
     `T/mcp.json → .mcp.json`, `T/vscode-mcp.json → .vscode/mcp.json`.
   - `auth` ≠ none → copy `T/login.<auth>.page.ts → pages/login.page.ts`
     (`form`, `azure-ad`, `google`; `okta-auth0` / `other` start from `login.form.page.ts`).
     `auth: none` → copy `T/login.form.page.ts` unchanged (auth.setup.ts imports it but skips login).
   - `sources` has `ado` → copy `T/scripts/fetch-tc.ts` and `T/scripts/ado-writer.ts → scripts/`.
   - WRITE `.env.example` from `T/env.example`, keeping only the keys this config needs
     (`BASE_URL`, `AUTH_REQUIRED` always; login keys when auth ≠ none; `TOTP_SECRET` when totp;
     ADO keys when sources has ado). Prefill `BASE_URL` with `base_url`; `AUTH_REQUIRED` is
     `true` iff auth ≠ none. `auth: none` and no ado → also WRITE `.env` with those two keys.
   - WRITE `pom-registry/INDEX.md` (table header only), `pom-registry/_shared.md` (empty
     heading), `test-cases/.gitkeep`, and `playwright/.auth/user.json` containing
     `{"cookies":[],"origins":[]}` so the MCP server can start before auth exists.
   - Say: "MCP config written — restart Copilot Chat / Claude Code (or reload the MCP server)
     so the Playwright browser tools are available." Continue with step 4 after that.
   - WRITE `QANYONE_STATE.md` (formats.md §3): `phase: setup`, `auth`, `sources`, `browsers`,
     `language` from config, `auth_ready: false`, `ado_configured: false`.
4. If auth ≠ none or sources has ado: say "Copy `.env.example` to `.env`, fill the values, then
   type `OK`." Wait. On `OK`: never open or search `.env` (its lines would land in the
   transcript). RUN a check that prints key names only:
   `node -e "require('dotenv').config();const m=process.argv.slice(1).filter(k=>!process.env[k]);console.log(m.length?'missing: '+m.join(' '):'ok')" LOGIN_USERNAME LOGIN_PASSWORD`
   (list the keys this config needs). `missing:` → repeat the request, wait again.
   Set `ado_configured: true` when the three ADO keys are present.
5. Auth first (auth ≠ none):
   a. BROWSER: `browser_navigate` to `base_url`, `browser_snapshot`. Identify the login form,
      email, password and submit elements and get a locator for each
      (`browser_generate_locator`). For `azure-ad` / `google` the template locators are already
      `[FROM TEMPLATE]`; only confirm the redirect to the provider happens.
      `two_fa ≠ none` (or any step that only appears after submitting credentials): do not type
      credentials yourself. Say "Log in once in the Playwright browser window that is open; tell
      me when you are on the app's home page." After each page the user reaches,
      `browser_snapshot` and take the 2FA input / button locators from it.
      BROWSER unavailable → RUN BACKGROUND `npx playwright codegen <base_url>`, ask the user to
      log in once and paste the recorded code; take locators from it (`[FROM CODEGEN]`).
      Google sign-in often blocks automated browsers; if it does, report BLOCKING.
   b. EDIT `pages/login.page.ts` with the discovered locators, the real login route and
      `loggedOutUrl`. Add to `tests/auth.setup.ts`, after the URL check, an `expect` on an
      element that only exists after login (seen in the snapshot). Record `LoginPage` in
      `pom-registry/_shared.md` with tags.
   c. RUN `npx playwright test --project=setup`. Fail → read the error, fix locator / route
      (max 3 rounds, rules.md Self-heal). CAPTCHA, unsupported MFA, wrong credentials →
      BLOCKING.
   d. Verify `playwright/.auth/user.json` exists and is larger than 100 bytes. EDIT state:
      `auth_ready: true`, `auth_updated: <today>`. Say: "Restart the Playwright MCP server so it
      picks up the storage state."
6. auth = none: RUN `npx playwright test --project=setup` (writes an empty storage state),
   then BROWSER `browser_navigate` to `base_url` and confirm the page title is non-empty.
   BROWSER unavailable → say which MCP config to enable; this is not blocking for SETUP.
7. EDIT state `phase: ready`. Report: what was created, which browsers, auth status, and
   "Next: `NEW TC <ADO id | path.md | name>`."

## B. Onboard (existing Playwright repo)
1. Scan, no questions: READ `playwright.config.ts` (`baseURL`, `projects`, `storageState`);
   SEARCH the page-object folder the config or layout implies (class names, public methods),
   `tests/**/*.spec.ts` (describe / test titles), `.env` (key names only),
   `playwright/.auth/*.json` or the configured storageState path (exists? age?).
2. Build a prefilled link and say: "Open this to confirm the detected settings, then paste the
   generated text here:"
   `QAnyone/setup/index.html?baseUrl=<…>&auth=<none|form|azure-ad|google|other>&sources=<ado if an ADO_PAT key exists>,md&browsers=<from projects>&language=en`
   Wait for the paste → WRITE `qanyone.config.md`.
3. Reconcile without overwriting the user's files:
   - WRITE `pom-registry/INDEX.md` + one `<feature>.md` per existing page class (feature =
     folder or file-name prefix; unsure → `misc`). Locators tagged `[FROM USER]`.
   - List specs with their describe titles in the report; do not create TC files for them.
   - WRITE `QANYONE_STATE.md` with the detected values; `tcs` empty.
   - Missing pieces (no `setup` project, no `fixtures/pages.fixture.ts`, no `.mcp.json` /
     `.vscode/mcp.json`, no `.gitignore` entries) → list them and ask once: "Add these?
     (OK / skip)". On OK, add from templates without touching existing files.
4. auth ≠ none and storage state missing or older than 7 days → run A.5c–d.
5. `phase: ready`; report as in A.7.

## Resume
`current_tc` set → READ `pipeline.md`, continue at `current_step`.
`phase: setup` → continue at the first A/B step whose output is missing.
