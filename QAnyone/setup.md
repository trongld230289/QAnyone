# SETUP

Decide the branch first, silently:
```
no playwright.config.ts                        → A. Scaffold
playwright.config.ts, no QANYONE_STATE.md      → B. Onboard
QANYONE_STATE.md exists                        → ASK: "Resume where I stopped" / "Rescan the project" / "Show STATUS"
```

## A. Scaffold (empty repo)
1. RUN `node QAnyone/setup/open.mjs` (opens the form in the default browser and prints its
   URL). Say: "The setup form is open in your browser (link above if not). Answer the
   questions, click **Generate**, copy the text and paste it here." Stop and wait for the paste.
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
     (`BASE_URL`, `AUTH_REQUIRED` and the four run flags `HEADLESS`, `TRACE`, `VIDEO`,
     `SCREENSHOT` always, with their defaults; login keys when auth ≠ none; `TOTP_SECRET` when
     totp; ADO keys when sources has ado). Prefill `BASE_URL` with `base_url`; `AUTH_REQUIRED` is
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
5. Auth first (auth ≠ none). **The login itself is done by `tests/auth.setup.ts` with the
   `.env` credentials — never ask the user to log in by hand when `two_fa: none`.**
   a. BROWSER: `browser_navigate` to `base_url`, `browser_snapshot` of the login page only.
      Identify the username, password and submit elements and get a locator for each
      (`browser_generate_locator`). Do not type credentials in the MCP browser. For `azure-ad` /
      `google` the template locators are already `[FROM TEMPLATE]`; only confirm the redirect
      to the provider happens.
      Only when `two_fa ≠ none`: the 2FA page exists only after submitting credentials, so say
      "Log in once in the Playwright browser window that is open, up to the 2FA screen; tell me
      when it shows." Then `browser_snapshot` and take the 2FA input / button locators from it.
      BROWSER unavailable → RUN BACKGROUND `npx playwright codegen <base_url>`, ask the user to
      log in once and paste the recorded code; take locators from it (`[FROM CODEGEN]`).
      Google sign-in often blocks automated browsers; if it does, report BLOCKING.
   b. EDIT `pages/login.page.ts` with the discovered locators, the real login route and
      `loggedOutUrl` (the URL pattern of the login page). Record `LoginPage` in
      `pom-registry/_shared.md` with tags. Keep the URL check in `tests/auth.setup.ts` as is.
   c. RUN `npx playwright test --project=setup` — this logs in with `LOGIN_USERNAME` /
      `LOGIN_PASSWORD` from `.env` and saves the storage state. Fail → read the error, fix
      locator / route (max 3 rounds, rules.md Self-heal). CAPTCHA, unsupported MFA, wrong
      credentials → BLOCKING.
   d. Verify `playwright/.auth/user.json` exists and is larger than 100 bytes. EDIT state:
      `auth_ready: true`, `auth_updated: <today>`. Say: "Restart the Playwright MCP server so it
      picks up the storage state." Optional, after the restart: `browser_navigate` to
      `base_url` (now logged in), pick one element that only exists after login, and add an
      `expect` on it to `tests/auth.setup.ts` as a stronger check.
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
2. RUN `node QAnyone/setup/open.mjs "?baseUrl=<…>&auth=<none|form|azure-ad|google|other>&sources=<ado if an ADO_PAT key exists>,md&browsers=<from projects>&language=en"`
   (opens the form prefilled with the detected settings). Say: "Confirm the detected settings
   in the form that just opened, click **Generate**, then paste the text here."
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

## C. UPDATE (after `npx github:trongld230289/QAnyone update`)
The framework files are already new; sync the generated files with `QAnyone/templates/`
without losing anything the user or the pipeline wrote. `T` = `QAnyone/templates/`.
1. Overwrite as-is (never hand-edited): `pages/base.page.ts`, `pages/page.template.ts`,
   `helpers/env.ts`, `helpers/totp.ts`, `scripts/*.ts` (only if present), `.mcp.json`,
   `.vscode/mcp.json`; `.gitignore` → add missing template lines, keep extras.
2. Merge (keep user values): `.env.example` — add keys that the template has and the file
   lacks, with the template defaults; never remove keys. Then say which keys are new so the
   user can copy them into `.env` (never open `.env`).
3. Merge (keep project choices): `playwright.config.ts` — READ both, replace the `use` block
   and the `flag(...)`/`STORAGE` helpers with the template's, keep `projects`, `testDir`,
   reporters and any extra options the project added. `tests/auth.setup.ts` — replace the
   template-origin lines (storage path, URL check), keep any app-specific `expect` the project
   added. `pages/login.page.ts` and `fixtures/pages.fixture.ts` — do not touch (they hold
   discovered locators and registered pages).
4. RUN `npx tsc -p tsconfig.json`; fix. RUN `npx playwright test --project=setup` when
   `auth ≠ none` to confirm login still works.
5. Report the files changed and the new `.env` keys (names only).

## Resume
`current_tc` set → READ `pipeline.md`, continue at `current_step`.
`phase: setup` → continue at the first A/B step whose output is missing.
