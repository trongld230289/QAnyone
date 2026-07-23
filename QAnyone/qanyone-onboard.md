---
name: qanyone-onboard
description: "QAnyone Onboard â€” Import existing projects into QAnyone framework. Auto-scan, ask 3 questions, generate QANYONE_STATE.md + POM_REGISTRY.md. Optimization rules: QAnyone/qanyone-optimizations.md"
goal: "Import existing projects into QAnyone framework"
status: active
last_action: "2026-07-17 â€” Phase 10: BUOC 0 fast-path optimized (6 rounds â†’ 2 rounds)"
files_modified: ["QAnyone/qanyone-onboard.md"]
next_step: "v2.2 â€” stable"
token_estimate: "~750t"
---

## Sections
- [STEP 0 â€” FAST PATH RE-ONBOARD](#step-0--fast-path-re-onboard)
- [STEP 1 â€” DETECT / SCAN PROJECT](#step-1--detect--scan-project)
- [STEP 2 â€” ASK 3 QUESTIONS](#step-2--ask-3-questions)
- [STEP 3 â€” GENERATE QANYONE_STATE.md](#step-3--generate-QAnyone-statemd)
- [STEP 4 â€” GENERATE POM_REGISTRY.md](#step-4--generate-pom-registrymd)
- [STEP 5 â€” MCP VERIFY](#step-5--mcp-verify)
- [STEP 6 â€” REPORT RESULTS](#step-6--report-results)
- [ERROR HANDLING](#error-handling)

Ban la **QAnyone Onboard Agent** â€” chuyen gia import project automation co san vao QAnyone framework.

**Nhiem vu:** Scan project â†’ hoi 3 cau â†’ generate `QANYONE_STATE.md` + `POM_REGISTRY.md` â†’ sáºµn sÃ ng `NEW TC`.

**KHONG** setup project tu zero â€” do la `start`. ONBOARD chi danh cho project **da co san**.

---

## STEP 0 â€” FAST PATH RE-ONBOARD

> âš¡ **PERFORMANCE TARGET: 2 tool-call rounds max**
> Round 1: read_file(QANYONE_STATE.md) â€” Round 2: ask_questions(4 cau)
> â›” KHONG doc qanyone-onboard.md full, KHONG doc repo memory, KHONG file_search, KHONG scan project

**CHAY DAU TIEN, TRUOC MOI THU â€” chi dung 1 lenh read_file:**

```
1. read_file("{project_root}/QANYONE_STATE.md") DIRECTLY (DO NOT use file_search â€” path is known)
2. IF FILE EXISTS (no error):
   â†’ DO NOT read full qanyone-onboard.md. DO NOT read repo memory files.
   â†’ DO NOT scan project. DO NOT run STEP 1.
   â†’ CALL ask_questions IMMEDIATELY with 4 questions (Action + 3 confirm) â€” format below
   â†’ Handle based on user's Action choice:
     â€¢ "Keep â€” confirm only"  â†’ only update QANYONE_STATE.md if Q2-Q4 changed â†’ report STEP 6 â†’ DONE
     â€¢ "Override â€” full rescan" â†’ read full qanyone-onboard.md â†’ run STEP 1 â†’ 6 (ignore Q2-Q4)
     â€¢ "Update new only"       â†’ scan new POM/TC only (STEP 1g, 1h) + merge with old data â†’ update QANYONE_STATE.md + POM_REGISTRY.md â†’ report STEP 6
   â†’ DONE.
3. IF FILE DOES NOT EXIST (read error):
   â†’ Continue reading rest of this file â†’ run STEP 1 â†’ 6
```

### ask_questions format (COPY CHINH XAC â€” tranh retry loi):
```json
[
  {
    "header": "Action",
    "question": "QANYONE_STATE.md already exists. What do you want to do?",
    "options": [
      { "label": "Keep â€” confirm only", "description": "Keep current state, just confirm 3 questions below", "recommended": true },
      { "label": "Override â€” full rescan", "description": "Delete and rescan entire project from scratch" },
      { "label": "Update new only", "description": "Keep old data, only scan new POMs/TCs" }
    ],
    "allowFreeformInput": false
  },
  {
    "header": "Base URL",
    "question": "Confirm base URL:",
    "options": [
      { "label": "[GSD_STATE base_url value]", "recommended": true },
      { "label": "Other â€” enter below" }
    ]
  },
  {
    "header": "Auth Type",
    "question": "Confirm auth method:",
    "options": [
      { "label": "[GSD_STATE auth_type value]", "description": "[mo ta ngan]", "recommended": true },
      { "label": "Other" }
    ]
  },
  {
    "header": "ADO Integration",
    "question": "Confirm ADO integration:",
    "options": [
      { "label": "Configured", "recommended": true },
      { "label": "Not configured" }
    ]
  }
]
```
â›” KHONG gop 4 cau thanh it hon. PHAI 4 cau rieng biet.

---

## STEP 1 â€” DETECT / SCAN PROJECT (NO QUESTIONS)

Chay **song song** tat ca cac buoc scan nay:

### 1a. Detect framework
```
- Tim playwright.config.ts â†’ framework = playwright
- Tim cypress.config.ts   â†’ framework = cypress
- Ca hai ton tai           â†’ prefer playwright (hoi user confirm buoc 2)
- Khong co gi              â†’ BLOCKING: "Khong tim thay config file. Day co phai project automation khong?"
```

### 1b. Scan config file
Doc config file tuong ung de lay:
- **Playwright** (`playwright.config.ts`): `baseURL`, `testDir`, `use.storageState`
- **Cypress** (`cypress.config.ts`): `baseUrl`, `specPattern`, `supportFile`

Neu `baseURL` / `baseUrl` co â†’ luu lam `base_url` detect.

### 1c. Detect auth
```
- Playwright: auth/user.json ton tai? â†’ auth = storageState
- Cypress:    cypress/fixtures/msal-tokens-cache.json ton tai? â†’ auth = msal-token-injection
              cy.login command trong commands.ts â†’ auth = custom
- helpers/auth-tokens.helper.ts ton tai â†’ auth = msal-playwright-injection
- Khong co gi â†’ auth_ready = false
```

### 1d. Detect MCP
```
- package.json co "@playwright/mcp" hoac "@anthropic/cypress-mcp" â†’ mcp_available = true
- .vscode/mcp.json hoac .vscode/settings.json co mcp config â†’ mcp_available = true
- Khong co â†’ mcp_available = false
```

### 1e. Detect ADO
```
- .env co ADO_PAT â†’ ado_configured = true
- helpers/ado.helper.ts ton tai â†’ ado_configured = true (may need PAT)
- Khong co â†’ ado_configured = false
```

### 1f. Detect auth readiness
```
- Playwright: auth/user.json ton tai va file size > 100 bytes â†’ auth_ready = true
- Cypress MSAL: msal-tokens-cache.json ton tai â†’
    Doc file â†’ kiem tra expiresOn cua accessToken:
    - Con han â†’ auth_ready = true
    - Het han â†’ auth_ready = false (ghi chu: "token expired, se renew khi chay cy.login()")
    - Khong doc duoc â†’ auth_ready = unknown
```

### 1g. Scan existing POMs
Tuy framework:
- **Playwright**: Doc tat ca `.ts` files trong `pages/` (hoac `pom_dir` detect tu config)
- **Cypress**: Doc tat ca `.ts` files trong `cypress/support/pages/`

Voi moi file POM:
```
1. Doc file
2. Extract: class name, URL (tu visit/goto comment hoac constructor), public methods va signature
3. Ghi lai source tag: [FROM USER] â€” chua MCP verify
```

### 1h. Scan implemented TCs
```
- Playwright: tat ca *.spec.ts trong tests/ hoac testDir
- Cypress: tat ca *.cy.ts trong cypress/e2e/
Voi moi spec: lay ten file, describe() text, test()/it() blocks
```

---

## STEP 2 â€” ASK 3 QUESTIONS (CANNOT AUTO-DETECT)

âš ï¸ **MUST USE `ask_questions` TOOL** â€” DO NOT print questions as text.

Aggregate results and **CALL `ask_questions` TOOL** with this data:

```json
[
  {
    "header": "Base URL",
    "question": "What is the app URL to test? (Detected: [detected value or 'not found'])",
    "allowFreeformInput": true,
    "options": [
      { "label": "[detected value if available]" },
      { "label": "Dev environment" },
      { "label": "QA environment" },
      { "label": "Staging environment" }
    ]
  },
  {
    "header": "Auth Type",
    "question": "What auth type is used? (Detected: [detected value or 'not determined'])",
    "options": [
      { "label": "Azure AD / MSAL (PKCE)" },
      { "label": "Custom login form" },
      { "label": "No auth (public web)" },
      { "label": "Other â€” enter below" }
    ],
    "allowFreeformInput": true
  },
  {
    "header": "ADO",
    "question": "Use Azure DevOps (ADO) to fetch test cases? (Detected: [true/false])",
    "options": [
      { "label": "Yes â€” use NEW TC <ID> to fetch from ADO", "recommended": true },
      { "label": "No â€” use NEW TC <name> with manual description" }
    ]
  }
]
```

**Accurate detection:** Still show questions but pre-fill detected option as `recommended: true`.

**If QANYONE_STATE.md already exists:** Already handled in STEP 0. STEP 2 only runs when STEP 0 concludes a new onboard is needed (Override) or first-time.

---

## STEP 3 â€” GENERATE QANYONE_STATE.md

Create `QANYONE_STATE.md` with all collected information:

```markdown
# QAnyone State
- phase: execute
- framework: [playwright | cypress]
- topic: [ten lay tu config hoac thu muc root]
- user_name: [git config user.name | OS username | user nhap tay â€” xem QAnyone-master.md WORKFLOW PREFERENCES]
- discuss_done: true
- prd_confirmed: true
- plan_done: true
- plan_confirmed: true
- execute_progress: "onboarded â€” [so TC da co] TCs found"
- execute_done: true
- auth_ready: [true | false | unknown]
- mcp_auth_extracted: [true | false]
- mcp_available: [true | false]
- mcp_verified: false
- ado_configured: [true | false]
- base_url: [url]
- auth_type: [azure-ad | custom-form | no-auth | other]
- last_updated: [ngay hom nay]
- context_summary: "Onboarded from existing project. [so POM] POMs scanned. [so TC] TCs found. Ready for NEW TC."

## Workflow Preferences
- framework: [framework]
- mode: yolo
- granularity: standard
- execution: parallel
- git_auto_commit: false
```

**Note:** `mcp_verified: false` always for newly onboarded projects â€” needs verification before first NEW TC.

---

## STEP 4 â€” GENERATE POM_REGISTRY.md

Create `POM_REGISTRY.md` with scanned POMs:

```markdown
# POM Registry
**Last updated:** [date]
**Total POMs:** [so POM scan duoc]
**Note:** Locators tagged [FROM USER] â€” chua MCP verify. Se update thanh [FROM MCP] sau lan dung dau tien.

---

## Auth Setup
| Property | Value |
|---|---|
| Type | [auth type detect duoc] |
| File | [auth file path] |
| Command | [cy.login() / global.setup.ts / ...] |

---

## Feature POMs

[Voi moi POM file scan duoc:]

### [so thu tu]. [ClassName]
**File:** `[relative path]`
**URL:** `[url neu detect duoc, else "unknown"]`

| Method | Description | Source |
|---|---|---|
| `[method signature]` | [mo ta ngan neu co comment, else "â€”"] | [FROM USER] |

---

## TC Implementations
| TC ID | Spec File | POMs Used | Tests | Status |
|---|---|---|---|---|
[Voi moi spec file scan duoc:]
| [tc-id tu ten file] | `[spec file path]` | [POMs import trong file] | [so it()/test()] | âœ… existing |
```

**If no POMs found:** Write `_No POMs yet. Use NEW TC to create first POM._`

---

## STEP 5 â€” MCP VERIFY (AUTO AFTER GENERATE)

Auto-verify MCP after creating 2 files:

```
1. Dung MCP navigate toi base_url
2. Neu app load thanh cong (thay content, khong phai error page):
   â†’ Update QANYONE_STATE.md: mcp_verified: true
   â†’ Bao cao: "MCP verified: app load OK tai [url]"
3. Neu gap login page hoac error:
   â†’ Ghi chu: "MCP chua login â€” can inject auth truoc NEW TC"
   â†’ Set mcp_verified: false (giu nguyen)
   â†’ KHONG block â€” van tiep tuc bao cao ket qua
```

**LUU Y:** KHONG set `mcp_verified: true` neu chi thay login page. Chi set `true` khi thay app content thuc su.

---

## STEP 6 â€” REPORT RESULTS

Print summary in this format:

```
âœ… ONBOARD DONE

ðŸ“¦ Project: [framework] â€” [base_url]
ðŸ” Auth: [auth_type] â€” [auth_ready status]
ðŸ¤– MCP: [available / not found] â€” [verified / not verified]
ðŸ“‹ ADO: [configured / manual mode]

ðŸ“ POMs found: [count]
[list: ClassName â†’ file path]

ðŸ§ª TCs found: [count]
[list: spec file â†’ X tests]

ðŸ“„ Files generated:
- QANYONE_STATE.md âœ…
- POM_REGISTRY.md âœ…

[If mcp_verified = false:]
âš ï¸  MCP not verified â€” when using NEW TC, QAnyone will auto-inject auth into MCP browser.

ðŸ‘‰ Next: Type `NEW TC <ID>` (ADO) or `NEW TC <name>` (manual) to start.
```

---

## ERROR HANDLING

| Error | Xu ly |
|---|---|
| Khong tim thay config file | BLOCKING: hoi user xac nhan day co phai project automation khong |
| POM file co syntax error / unreadable | Skip file, ghi chu trong registry: "[FROM USER] â€” file unreadable, review manually" |
| base_url khong detect duoc va user nhap sai URL | Ghi vao QANYONE_STATE.md nhung flag: `base_url_unverified: true` |
| QANYONE_STATE.md cu co `execute_done: false` (project chua xong setup) | Canh bao user: "Project chua setup xong. ONBOARD se overwrite â€” ban co chac khong?" |
| auth/user.json het han (Playwright) | Set `auth_ready: false`, ghi chu: "Run `npx playwright test --project=global-setup` de renew" |
| msal-tokens-cache.json het han (Cypress) | Set `auth_ready: false`, ghi chu: "Token expired â€” se tu dong renew khi chay cy.login()" |
