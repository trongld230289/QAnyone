# QAnyone — QA + Anyone · Playwright automation for everyone

QAnyone is an instruction package for an AI agent (GitHub Copilot Chat or Claude Code) that
writes and maintains Playwright end-to-end tests for a web app. Test cases come from Azure
DevOps, from markdown files you already have, or from a flow you record once with codegen.
All three become one markdown file per test case, and one pipeline turns that file into a
page object, a spec, a passing run and a memory for the next test.

## Install

In an **empty repository** dedicated to tests:

```
npx github:trongld230289/QAnyone init
```

Then open the folder in Copilot Chat (Agent mode) or Claude Code and type `SETUP`.
The installer also writes the Playwright MCP config for both tools, the approval settings and an
empty storage state, so the browser tools are available from the first chat with no restart.

If the repo already has a `CLAUDE.md` or `.github/copilot-instructions.md`, they are kept: the installer
appends a marked QAnyone block (`<!-- qanyone:start -->` … `<!-- qanyone:end -->`) and later updates
replace only that block.

Manual alternative: copy `QAnyone/` into the repo and paste the contents of the package's `CLAUDE.md`
into your own `CLAUDE.md` / `.github/copilot-instructions.md`.

**Update an existing project:** `npx --prefer-online github:trongld230289/QAnyone update` then type `UPDATE`
in the chat — the AI syncs the generated config/helpers with the new templates and keeps your
values, locators and tests. `--prefer-online` matters: without it npx may reuse a cached copy of the
package and you keep the old framework files.

## Approvals
`SETUP` writes `.claude/settings.json` (Claude Code: `acceptEdits`, the pipeline's `npm` / `npx` /
`node` commands and the Playwright MCP tools allowed, reading `.env` denied) and
`.vscode/settings.json` (Copilot Chat: terminal commands auto-approved, `chat.tools.global.autoApprove`
on). So `NEW TC` runs without a prompt per step; it still stops once to confirm normalized steps for
markdown / codegen sources, and before `PUSH ADO`. Edit those two files to tighten.

## Commands
| Command | What it does |
|---|---|
| `SETUP` | First-time scaffold, import of an existing Playwright repo, or resume — auto-detected. Opens an offline HTML form for the 8 setup questions (2 required, EN/VI). |
| `NEW TC <ADO id>` | Fetch a test case from Azure DevOps and build the test |
| `NEW TC <path.md>` | Normalize a free-form markdown file (one or many test cases), confirm once, build the tests |
| `NEW TC <name>` | Record the flow with Playwright codegen, confirm the steps, build the test |
| `RERUN TC <id>` | Re-run one test (regenerates the spec if its test case file changed) |
| `STATUS` | Phase, auth state, test cases and page-object registry |
| `PUSH ADO <id>` | Create or update the test case in Azure DevOps after a preview |
| `UPDATE` | After `npx … update`: sync generated files with the new framework templates |

## How a test case flows
```
ADO id ─┐
md file ─┼─► test-cases/<id>-<slug>.md ─► map pages ─► discover locators (Playwright MCP)
codegen ┘        (source of truth)        ─► page object + fixture ─► spec ─► run ─► self-heal ≤3 ─► memory ─► report
```
Rules the agent follows: never guess a locator, auth first, one real `expect()` per expected
result, no hard sleeps, self-heal may fix locators and waits but never weaken assertions.

## Generated project layout
```
playwright.config.ts · tests/auth.setup.ts · tests/<feature>/<id>-<slug>.spec.ts
pages/*.page.ts · fixtures/pages.fixture.ts · helpers/ · scripts/ (ADO)
test-cases/ · pom-registry/ · QANYONE_STATE.md · qanyone.config.md · .env (ignored)
```

## Package contents
| Path | Purpose |
|---|---|
| `QAnyone/core.md` | Commands, platform tool map, hard rules, error handling |
| `QAnyone/setup.md` | `SETUP`: scaffold / onboard / resume |
| `QAnyone/pipeline.md` | `NEW TC`, `RERUN TC`, `PUSH ADO`, `STATUS` |
| `QAnyone/formats.md` | Test case, registry, state and config formats |
| `QAnyone/rules.md` | Locator, action, assertion and self-heal rules |
| `QAnyone/setup/index.html` | Offline setup form (`setup/open.mjs` opens it in the browser, prefilled on Onboard) |
| `QAnyone/setup/scaffold.mjs` | Builds the project from `qanyone.config.md` + templates in one command; never overwrites |
| `QAnyone/templates/` | Playwright config, auth setup, page objects, fixture, helpers, ADO scripts, IDE approval settings |

## Development (this repo)
`npm install` then `npm test` runs the package lint, script tests, form tests and a scaffold
smoke test against the public Playwright TodoMVC demo. See `docs/DEVELOPMENT.md`.
