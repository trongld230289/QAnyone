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
The Playwright MCP server config is generated for both tools during setup.

Manual alternative: copy `QAnyone/`, `CLAUDE.md` and `.github/copilot-instructions.md` into the repo.

## Commands
| Command | What it does |
|---|---|
| `SETUP` | First-time scaffold, import of an existing Playwright repo, or resume — auto-detected. Opens an offline HTML form for the 10 setup questions. |
| `NEW TC <ADO id>` | Fetch a test case from Azure DevOps and build the test |
| `NEW TC <path.md>` | Normalize a free-form markdown file (one or many test cases), confirm once, build the tests |
| `NEW TC <name>` | Record the flow with Playwright codegen, confirm the steps, build the test |
| `RERUN TC <id>` | Re-run one test (regenerates the spec if its test case file changed) |
| `STATUS` | Phase, auth state, test cases and page-object registry |
| `PUSH ADO <id>` | Create or update the test case in Azure DevOps after a preview |

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
| `QAnyone/setup/index.html` | Offline setup form |
| `QAnyone/templates/` | Playwright config, auth setup, page objects, fixture, helpers, ADO scripts |

## Development (this repo)
`npm install` then `npm test` runs the package lint, script tests, form tests and a scaffold
smoke test against the public Playwright TodoMVC demo. See `docs/DEVELOPMENT.md`.
