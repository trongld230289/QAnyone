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
   - RUN `node QAnyone/setup/scaffold.mjs` — one command, never overwrites (existing files are
     reported `kept`). Do not copy template files one by one. It writes, from the config:
     `playwright.config.ts` (firefox/webkit projects uncommented per `browsers`), `tsconfig.json`,
     `pages/base.page.ts`, `pages/page.template.ts`, `fixtures/pages.fixture.ts`, `helpers/env.ts`,
     `helpers/totp.ts`, `helpers/excel.ts`, `tests/auth.setup.ts`, `.gitignore`, `pages/login.page.ts` (from
     `T/login.<auth>.page.ts`; `okta-auth0` / `other` / `none` use the form one), `scripts/*.ts`
     when `sources` has `ado`; the IDE files when missing (`.mcp.json`, `.vscode/mcp.json`,
     `playwright-mcp.json`, `.claude/settings.json`, `.vscode/settings.json`); `.env.example` and
     `.env` with only the keys this config needs (`BASE_URL`, `ADO_ORG`, `ADO_PROJECT` prefilled,
     `AUTH_REQUIRED` = auth ≠ none, run flags with defaults, secret values empty); `pom-registry/`,
     `test-cases/.gitkeep`, `playwright/.auth/user.json`. Its last line names the `.env` keys the
     user must fill. After this, never read `.env`.
   - RUN `npx tsc -p tsconfig.json`. An error in a file reported `kept` means a leftover from an
     earlier project (an open editor tab can save a deleted file again): list those files, ask
     the user to delete them and close their tabs, then rerun the scaffold.
   - `.claude/settings.json` / `.vscode/settings.json` reported `kept` → add only the keys of
     `T/claude-settings.json` / `T/vscode-settings.json` they lack (the file is the user's).
   - Only if the BROWSER tools are not available in this chat (the MCP config was created just
     now): say "Restart Copilot Chat / Claude Code once so the Playwright browser tools load",
     then continue with step 4.
   - WRITE `QANYONE_STATE.md` (formats.md §3): `phase: setup`, `auth`, `sources`, `browsers`,
     `language` from config, `auth_ready: false`, `ado_configured: false`.
4. If the scaffold named keys to fill: say "Open `.env` and fill in <those keys>, then type
   `OK`." Wait. On `OK`: never open or search `.env` (its lines would land in the
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
      `two_fa: totp` → the code is computed by `helpers/totp.ts` from `TOTP_SECRET` and typed
      by `tests/auth.setup.ts` (`enterTotp`); never type a code through BROWSER, never add an
      OTP library. `azure-ad`: the TOTP locators are `[FROM TEMPLATE]` too — go straight to c.
      `form` with 2FA: the 2FA page exists only after submitting credentials, so say "Log in
      once in the Playwright browser window that is open, up to the 2FA screen; tell me when
      it shows." Then `browser_snapshot` and take the 2FA input / button locators from it.
      BROWSER unavailable → RUN BACKGROUND `npx playwright codegen <base_url>`, ask the user to
      log in once and paste the recorded code; take locators from it (`[FROM CODEGEN]`).
      Google sign-in often blocks automated browsers; if it does, report BLOCKING.
   b. EDIT `pages/login.page.ts` with the discovered locators, the real login route and
      `loggedOutUrl` (the URL pattern of the login page). Record `LoginPage` in
      `pom-registry/_shared.md` with tags. Keep the URL check in `tests/auth.setup.ts` as is.
   c. RUN `npx playwright test --project=setup --headed` — this logs in with `LOGIN_USERNAME` /
      `LOGIN_PASSWORD` from `.env` and saves the storage state; `--headed` so the user can watch
      the login (later runs follow `HEADLESS` in `.env`). Fail → read the error, fix
      locator / route (max 3 rounds, rules.md Self-heal). CAPTCHA, unsupported MFA, wrong
      credentials → BLOCKING.
   d. Verify `playwright/.auth/user.json` exists and is larger than 100 bytes. EDIT state:
      `auth_ready: true`, `auth_updated: <today>`. Load the session into the MCP browser without
      a restart: `browser_set_storage_state` with `filename: playwright/.auth/user.json` (tool
      missing → `browser_close`, the next `browser_navigate` starts a session from that file).
      Optional: `browser_navigate` to `base_url` (now logged in), pick one element that only
      exists after login, and add an `expect` on it to `tests/auth.setup.ts` as a stronger check.
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
   - Missing pieces (no `setup` project, no `fixtures/pages.fixture.ts`, no `.claude/settings.json` /
     `.vscode/settings.json` approvals, no `.mcp.json` /
     `.vscode/mcp.json`, no `.gitignore` entries) → list them and ask once: "Add these?
     (OK / skip)". On OK, add from templates without touching existing files.
4. auth ≠ none and storage state missing or older than 7 days → run A.5c–d.
5. `phase: ready`; report as in A.7.

## C. UPDATE (after `npx github:trongld230289/QAnyone update`)
The framework files are already new; sync the generated files with `QAnyone/templates/`
without losing anything the user or the pipeline wrote. `T` = `QAnyone/templates/`.
1. Overwrite as-is (never hand-edited): `pages/base.page.ts`, `pages/page.template.ts`,
   `helpers/env.ts`, `helpers/totp.ts`, `helpers/excel.ts`, `scripts/*.ts` (only if present), `.mcp.json`,
   `.vscode/mcp.json`, `playwright-mcp.json`; `.claude/settings.json` and `.vscode/settings.json`
   → add keys the template has and the file lacks, keep the rest; `.gitignore` → add missing template lines, keep extras.
2. Merge (keep user values): `.env.example` — add keys that the template has and the file
   lacks, with the template defaults; never remove keys. Then say which keys are new so the
   user can copy them into `.env` (never open `.env`).
3. Merge (keep project choices): `playwright.config.ts` — READ both, replace the `use` block
   and everything above `defineConfig` with the template's, add `...win` after each
   `devices[...]` spread; keep `projects`, `testDir`, reporters and extra options the project added. `tests/auth.setup.ts` — replace the
   template-origin lines (storage path, URL check), keep any app-specific `expect` the project
   added. `pages/login.page.ts` and `fixtures/pages.fixture.ts` — do not touch (they hold
   discovered locators and registered pages).
4. RUN `npx tsc -p tsconfig.json`; fix. RUN `npx playwright test --project=setup` when
   `auth ≠ none` to confirm login still works.
5. Report the files changed and the new `.env` keys (names only).

## Resume
`current_tc` set → READ `pipeline.md`, continue at `current_step`.
`phase: setup` → continue at the first A/B step whose output is missing.
