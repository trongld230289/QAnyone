# QAnyone rules — read before writing any POM or spec

## Locator
- Never guess. Allowed sources, cheapest first: `pom-registry` → TC `Locators` table →
  BROWSER (`browser_snapshot` on the page, then `browser_generate_locator` for the element;
  if that tool is missing, derive from the snapshot's role + name).
- Keep snapshots small: perform the preceding steps first so only the relevant screen is
  captured; pass `depth` (6–8) or `filename` and SEARCH the saved file for the role / name,
  instead of pulling a whole 30 KB page into the chat. One snapshot per screen, not per element.
- Tag every locator: `[FROM MCP]` `[FROM CODEGEN]` `[FROM USER]` `[FROM TEMPLATE]`.
- Priority: `getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > `getByTestId` > CSS.
  CSS only when BROWSER confirms nothing else is unique.
- Repeated names (one "Delete" per row, one checkbox per row): scope by container —
  `page.getByRole('row', { name: 'Job A' }).getByRole('button', { name: 'Delete' })` or
  `.filter({ hasText })`. Never `.nth()` unless the TC literally says "row N".
  If the TC gives no context to choose → BLOCKING: ask the user which one.
- Discover per missing element, never re-discover a whole page that is already in the registry.
- Never write Node scripts, `page.evaluate`, or DOM dumps to find locators.
- Keep a locator in exactly one place: the POM. Specs use POM methods or locators from the
  fixture-provided page object; inline locators only for one-off assertions.

## Action
- `Check` → `.check()`, `Uncheck` → `.uncheck()`. Never `.click()` on a checkbox (click toggles
  blindly; check/uncheck are idempotent).
- `Select` → `.selectOption()` for `<select>`; for custom dropdowns: click the trigger, then
  `getByRole('option', { name })`.
- `Press` → `locator.press('Enter')` on the focused element, or `page.keyboard.press`.
- `Navigate` → `page.goto(path)` then `await expect(page).toHaveURL(...)`.
- Wait only with `expect(...).toBeVisible()`, `toHaveURL`, `waitForURL`, `waitForResponse`.
  Hard sleeps are forbidden everywhere, including "to make the video readable" — the config
  already keeps `trace`, `video` and a screenshot for every failed test (`test-results/`);
  the user turns them on for passing tests too via `TRACE` / `VIDEO` / `SCREENSHOT` in `.env`,
  and watches the browser with `HEADLESS=false`.

### Known-hard patterns (wrong *action*, not wrong locator — check these before BROWSER)
| Pattern | Symptom | Correct code |
|---|---|---|
| Native dialog (`alert/confirm/prompt`) | script hangs forever | register `page.on('dialog', d => d.accept())` **before** the triggering action |
| File upload | replay opens the OS file picker | `locator.setInputFiles(path)` — never click the input |
| File download | test passes but nothing verified | `const [dl] = await Promise.all([page.waitForEvent('download'), trigger])`, then `await dl.saveAs(testInfo.outputPath(dl.suggestedFilename()))` and check the content; `.xlsx` → `readWorkbook(path)` from `helpers/excel.ts`, no Excel library |
| iframe | "element not found" though visible | `page.frameLocator(sel).getByRole(...)` |
| New window / popup | clicks go to the old tab | `const [popup] = await Promise.all([page.waitForEvent('popup'), trigger])`, then `new XPage(popup)` |
| Server-side job (export, report, import) | status stays "in progress", test times out | `await expect(async () => { await refresh.click(); await expect(doneCell).toBeVisible({ timeout: 2_000 }); }).toPass({ timeout, intervals: [5_000] })` + `test.setTimeout()` sized from the duration measured in BROWSER |
| Data table / grid | `.first()` or a count hits a header or empty row; a cell also holds a badge | data rows = `table.getByRole('row').filter({ has: page.getByRole('cell') })`; compare the cell's first line (`innerText().split('\n')[0]`) or use `toContainText` |
| Custom checkbox / multiselect (native input hidden) | `check()` fails: element not visible | read the state from the input (`isChecked()`) and click the visible widget only when it must change (the one case a checkbox is clicked); reach the widget from its label (`getByText(label).locator('..')`) |
| HTML5 drag & drop | `.dragTo()` runs, UI unchanged | dispatch `dragstart` / `dragover` / `drop` manually |
| Open shadow DOM | usually fine | normal locators pierce open roots; only escalate when it really fails |
| Closed shadow DOM | nothing can see it | BLOCKING — tell the user it needs `data-testid` from the dev team |

## Assertion
- Every non-empty Expected in the TC → at least one real `expect()` in the spec.
- No soft assertions, no `try/catch` around locators or assertions, no `test.skip`/`test.fixme`.
- POM classes contain no assertions; specs do.
- Prefer `toBeVisible`, `toHaveText`, `toContainText`, `toHaveURL`, `toHaveCount`, `toBeChecked`.
- Empty value → `toHaveText('')` on the element itself, never `toHaveCount(0)` on its children
  (frameworks keep empty wrapper elements).

## Self-heal (max 3 rounds per test run)
Allowed fixes
- Locator wrong/ambiguous → re-discover through BROWSER on the live page, update POM + registry.
- Missing wait → add the right `expect`/`waitForURL` before the failing action.
- Wrong verb mapping (e.g. click on checkbox) or a Known-hard pattern → fix the action.
- Test data typo → fix Test Data in the TC file, regenerate the spec.

Forbidden fixes
- Weakening, removing or commenting out an assertion; changing an Expected to match the app.
- Hard sleeps, soft assertions, `try/catch`, `test.skip`/`fixme`, skipping a step.
- Increasing timeouts above 2× the default. Only exception: a server-side job (Known-hard
  table) whose duration you measured in BROWSER — write that duration next to `test.setTimeout`.

Every run ends in an explicit state: `passing`, or after 3 failed rounds / an app bug /
a wrong TC → `status: blocked` with the reason and the trace/screenshot path in the TC `Notes`.
Never report a blocked test as fixed.

## POM and spec shape
POM (`pages/<name>.page.ts`): one class per page extending `BasePage`; `readonly` locators
assigned in the constructor; methods are business actions (`search(keyword)`, `openJob(name)`);
`path` is relative to `baseURL`. Register new pages in `fixtures/pages.fixture.ts`.
Spec (`tests/<feature>/<id>-<slug>.spec.ts`): `test.describe('<id> <title>', { tag: ['@regression'] })`,
one `test()` per TC, one `test.step('<n>. <Action>')` per TC row, data from a `const data = {...}`
block generated from Test Data. Use the fixture (`async ({ jobsPage }) =>`), not `new JobsPage(page)` —
except a page opened in a popup / new tab: `new XPage(popup)`. A spec that creates data (a record, a
file on the server) deletes it in `test.afterEach`, so a failed run cleans up too, unless a TC step
already deletes it.
