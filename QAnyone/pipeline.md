# NEW TC · RERUN TC · PUSH ADO · STATUS

Read `rules.md` before step 5 and `formats.md` before step 2. After every step: EDIT
`QANYONE_STATE.md` (`current_tc`, `current_step`). A new chat continues from `current_step`
without repeating earlier questions. Several ids → run the whole pipeline per id, in order.
TASKS before the first step: exactly one item per step that will run, titled `1 Intake`,
`2 Normalize`, `3 Map`, `4 Discover`, `5 POM`, `6 Spec`, `7 Run + self-heal`, `8 Memory`,
`9 Report` (RERUN TC or resume: only the steps left). The test case's own steps are never
tasks. Several test cases → prefix each title with the test case id and rewrite the list when
the next one starts. Mark an item in progress when its step starts, completed when it ends.

## NEW TC
### 0. Precheck (silent)
`phase: ready`; `auth_ready: true` when `auth ≠ none`; BROWSER tools available (otherwise
say which MCP config to enable and stop). Numeric id but `ado_configured: false` → BLOCKING
("fill the ADO keys in .env, or give a markdown file").

### 1. Intake → raw steps
- `NEW TC <number>` → RUN `npx tsx scripts/fetch-tc.ts <id>` → JSON `{ id, title, steps[] }`.
- `NEW TC <path.md>` → READ the file. Any shape: tables, bullets, Gherkin, numbered prose,
  Vietnamese or English, one or many test cases. Split into test cases at headings, or at
  blank-line-separated blocks that start a new scenario.
- `NEW TC <name>` → RUN BACKGROUND
  `npx playwright codegen <base_url> --load-storage=playwright/.auth/user.json`
  (omit `--load-storage` when auth = none). Say: "The browser is open. Do the flow once, then
  copy the recorded code from the Playwright Inspector and paste it here." Wait. Parse the paste:
  `goto` → Navigate, `click` → Click, `fill` → Fill, `check` / `uncheck` → Check / Uncheck,
  `selectOption` → Select, `press` → Press, `setInputFiles` → Upload, `expect(...)` → Verify
  with Expected taken from the matcher. Keep every locator for the TC Locators table
  (`[FROM CODEGEN]`).

### 2. Normalize → `test-cases/<id>-<slug>.md`
Write one file per test case from `QAnyone/templates/test-case.md` following formats.md §1:
id (ADO id · an id found in the file · otherwise the next free `TC-<n>` — SEARCH `test-cases/`
first; several TCs in one file get consecutive numbers; an id found in the file that already
exists in `test-cases/` is a collision → take the next free number and say so), title, `source`, `source_ref`, `feature` and `page` inferred from the steps (URL
path or the page named in step 1), tags, `status: draft`. Rewrite steps with the fixed verbs,
quoted element names, `{{key}}` data, `[Pre]` first row; move repeated literals into Test Data.
Text language per state `language`.
Print the Steps and Test Data tables of every file just written in the message (every source).
CONFIRM (sources `md` and `codegen` only): then ASK "Confirm these steps?" with the options
`OK` / `I edited the file(s), re-read them`. Repeat until OK. Then `status: confirmed`.
ADO source: no ASK; set `confirmed` directly and continue.

### 3. Map
READ `pom-registry/INDEX.md`, the `<feature>.md` of the TC, and `_shared.md` when the steps
touch navigation, login or dialogs. For every quoted element in the steps decide: registry hit
(reuse) · TC Locators hit (codegen) · missing.

### 4. Discover (missing elements only — rules.md Locator)
Check rules.md Known-hard patterns first: iframe, dialog, upload, download, popup, drag-drop are
action problems, not locator problems. Then BROWSER: `browser_navigate` to the page (`base_url`
+ `page`), perform the preceding steps when the element only appears after an action,
`browser_snapshot`, then `browser_generate_locator` per missing element. Repeated names → scope
by row / container; no context in the TC → BLOCKING ask. Add rows to the TC Locators table
with `[FROM MCP]`. Steps performed here can create data on the app (a record, an export): list
each item in the TC Notes and delete it in BROWSER when done, if the app allows. Waiting for a
server-side job: note how long it took — the spec's timeout is sized from it (rules.md).

### 5. POM (rules.md POM shape)
WRITE / EDIT `pages/<page>.page.ts` following `pages/page.template.ts`: add locators, one
method per step verb group. New page → add the three lines in `fixtures/pages.fixture.ts` at
the `PAGES-IMPORT`, `PAGES-TYPE`, `PAGES-FIXTURE` markers. EDIT `pom-registry/<feature>.md`
(+ the `INDEX.md` row, `Used by` ids). Login / navigation pieces go to `_shared.md` instead.

### 6. Spec
WRITE `tests/<feature>/<id>-<slug>.spec.ts`:
```ts
import { test, expect } from "../../fixtures/pages.fixture";

const data = { keyword: "QA" }; // from Test Data

test.describe("102874 Search job by keyword", { tag: ["@regression"] }, () => {
  test("102874 Search job by keyword", async ({ page, jobsPage }) => {
    await test.step("1. [Pre] Logged in, on home page", async () => {
      await page.goto("/");
    });
    await test.step('2. Click "Jobs"', async () => {
      await jobsPage.goto();
      await expect(page).toHaveURL(/\/jobs/);
    });
    await test.step('3. Fill "{{keyword}}" into "Search", press Enter', async () => {
      await jobsPage.search(data.keyword);
    });
    await test.step("4. Verify results table", async () => {
      await expect(jobsPage.resultsTable).toContainText(data.keyword);
    });
  });
});
```
`describe` and `test` titles are both `<id> <title>`. One `test.step` per TC row, same numbering and text. Every non-empty Expected → `expect()`.
EDIT the TC frontmatter `spec:`. RUN `npx tsc -p tsconfig.json`; fix type errors.

### 7. Run + self-heal
RUN `npx playwright test <id> --project=chromium` (then each extra browser in state).
Fail → read the error and `test-results/**/error-context.md`; apply only the allowed fixes
(rules.md Self-heal); rerun. Max 3 rounds. Still failing, or the failure is an app bug / a
wrong TC → `status: blocked`, reason + trace path in the TC Notes.

### 8. Memory
EDIT the TC frontmatter: `status: passing | blocked`, `last_run`, `heal_count` (+ the reason
and trace path in Notes when blocked). EDIT `pom-registry` `Used by`. EDIT state: `tcs.<id>`,
clear `current_tc` / `current_step`.

### 9. Report
```
TC 102874 — Search job by keyword          passing · 1 heal
steps 4 · locators 3 reused / 2 new ([FROM MCP]) · browsers chromium
spec   tests/jobs/102874-search-job.spec.ts
report npx playwright show-report
```
Blocked → the reason and what the user should check. Never say "fixed" for a blocked test.

## RERUN TC <id>
READ the TC file. If it is newer than the spec, or `status: draft` → run steps 3–6.
Then steps 7–9.

## PUSH ADO <id>
Requires `ado_configured: true`. READ the TC file. Print the Steps table as it will appear in
ADO (row 1 precondition, rows 2+ action / expected, `{{key}}` replaced by Test Data values).
ASK "Push to Azure DevOps?" with the options `Update existing TC <id>` (when source is ado or
the id is numeric) · `Create new test case` (free text for an optional User Story id) · `Cancel`.
- Update → RUN `npx tsx scripts/ado-writer.ts update --tc <id> --from test-cases/<id>-<slug>.md`
  (the script reads Steps + Test Data and substitutes `{{key}}`; the `[Pre]` row goes first).
- Create → RUN `npx tsx scripts/ado-writer.ts create --from test-cases/<id>-<slug>.md [--us <id>]`
  → new ADO id → rename `test-cases/<old>-….md`, the spec file, the describe title, the
  registry `Used by` ids and `tcs` in state to the new id; `source_ref: ado:<id>`.
Report the ADO id and the work-item URL `<ado_org>/<project>/_workitems/edit/<id>`.

## STATUS
Print: phase, auth + `auth_updated`, sources, browsers; a table of `tcs` (id, title from the
file, status, spec); registry: pages per feature and locator counts from `INDEX.md`.
