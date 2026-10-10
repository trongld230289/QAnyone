# QAnyone file formats

## 1. Test case — `test-cases/<id>-<slug>.md` (source of truth)
Template: `QAnyone/templates/test-case.md`. One file per test case.

Frontmatter
| Key | Value |
|---|---|
| id | ADO work item id (`102874`) or `TC-<n>` — next free number; never reuse an id present in `test-cases/` |
| title | short imperative sentence |
| source | `ado` · `md` · `codegen` |
| source_ref | `ado:<id>` · original file path · `codegen:<date>` |
| feature | kebab-case; decides `tests/<feature>/` and `pom-registry/<feature>.md` |
| page | route of the main page, e.g. `/jobs` |
| tags | list; `regression` by default, `smoke` when the TC says so. Used as `@tag` in the spec |
| status | `draft` → `confirmed` → `passing` / `blocked` (blocked = self-heal exhausted, app bug, wrong TC, or abandoned) |
| spec, last_run, heal_count | filled by the pipeline (steps 6–8) |

Slug = title, lowercase, non-alphanumerics → `-`, max 40 chars.

Steps rules
- Row 1 is always `[Pre]` (precondition; Expected empty). Rows 2+ are one user action each.
- Verbs, exactly: `Click`, `Fill`, `Check`, `Uncheck`, `Select`, `Press`, `Navigate`, `Upload`,
  `Verify`. Keep `Check`/`Uncheck` — do not turn them into `Click`.
- Refer to elements by their visible name in double quotes: `Click "Save"`,
  `Fill "{{email}}" into "Email"`. No code, no locators, no CSS in Action/Expected.
- Values that repeat or depend on the environment are `{{key}}` and declared in Test Data.
  A one-off literal may stay inline in quotes.
- Every `Verify` row has a non-empty Expected. An Expected on an action row is allowed and
  becomes an `expect()` right after that action. A literal `|` inside a cell is written `\|`.
- Language of Action/Expected text = `language` in state (`vi` or `en`).

Locators table: filled by the pipeline from the registry / codegen / BROWSER. The user may
add rows (`[FROM USER]`). Source is one of `[FROM MCP]`, `[FROM CODEGEN]`, `[FROM USER]`,
`[FROM TEMPLATE]`.

Notes: free text (user remarks, reason for `blocked`, trace path).

## 2. POM registry — `pom-registry/`
```
INDEX.md      one row per page
_shared.md    components used on many pages: navigation, header, login, confirm dialog
<feature>.md  pages of one feature
```
`INDEX.md`
| Page path | Feature | File | Class | Locators |
|---|---|---|---|---|
| /jobs | jobs | pages/jobs.page.ts | JobsPage | 6 |

`<feature>.md` and `_shared.md`
```
## JobsPage · pages/jobs.page.ts · /jobs
| Element | Locator | Source | Used by |
|---|---|---|---|
| jobsLink | getByRole('link', { name: 'Jobs' }) | [FROM MCP] | 102874, TC-003 |
### Methods
- goto() · search(keyword: string) · openJob(name: string)
```
Reading rule: INDEX + the feature file(s) of the TC (`feature`, `page`) + `_shared.md` when the
TC touches navigation, login or dialogs. A page missing from INDEX is created in the TC's
feature file. Element names are camelCase and unique within a class. Methods list has no assertions.

## 3. State — `QANYONE_STATE.md`
```yaml
phase: setup            # setup | ready
auth: none              # none | form | azure-ad | google | okta-auth0 | other
auth_ready: false
auth_updated:           # YYYY-MM-DD when playwright/.auth/user.json was last created
sources: [md]           # subset of [ado, md, codegen]
ado_configured: false
browsers: [chromium]
language: en
current_tc:             # id while NEW TC / RERUN TC is in progress, else empty
current_step:           # 1-intake 2-normalize 3-map 4-discover 5-pom 6-spec 7-run 8-memory 9-report
tcs: {}                 # id: status
```
Written after every pipeline step. `current_tc` / `current_step` are cleared at 8-memory.

## 4. Config — `qanyone.config.md` (produced by the setup form)
```yaml
---
base_url: "https://app.example.com"
auth: form                       # none | form | azure-ad | google | okta-auth0 | other
auth_other: ""                   # free text when auth = other
two_fa: none                     # none | totp | sms | push | unknown  (only when auth != none)
totp_secret_available: false     # only when two_fa = totp
sources: [md, codegen]           # ado | md | codegen
ado_org: ""                      # https://dev.azure.com/<org>   (only when sources has ado)
ado_project: ""
browsers: [chromium]             # chromium | firefox | webkit
test_data: existing              # existing | self-create-cleanup | seed | unknown
language: en                     # vi | en
---
## Notes
<app notes and user-added question/answer pairs, one per paragraph>
```
Read once by SETUP; afterwards `QANYONE_STATE.md` is the source of truth. Notes are kept as
free context: read them before writing auth code and before DISCOVER on a new page.

## 5. `.env` (never committed, never read for values)
`BASE_URL`, `AUTH_REQUIRED=true|false`, run flags `HEADLESS=true|false`,
`TRACE` / `VIDEO` = `on|retain-on-failure|off`, `SCREENSHOT` = `on|only-on-failure|off`,
`LOGIN_USERNAME`, `LOGIN_PASSWORD`, `TOTP_SECRET`, `ADO_ORG`, `ADO_PROJECT`, `ADO_PAT`.
The run flags are the only values the user is expected to flip by hand; the config reads them. SETUP writes `.env.example` with only the keys the config needs.
