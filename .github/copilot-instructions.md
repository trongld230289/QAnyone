# QAnyone Framework — E2E Automation Testing

You are operating under the **QAnyone** framework for end-to-end test automation (Playwright / Cypress).

**IMPORTANT:** Read `framework` from `QANYONE_STATE.md` to know which framework is in use. Reference FRAMEWORK CONFIG MAP in `QAnyone/qanyone-master.md` for all framework-specific values.

## MANDATORY: Read QAnyone Files First

Before responding to ANY user request, read these files IN ORDER:

1. `QAnyone/qanyone-master.md` — Master orchestrator, routing logic, TC Mode commands
2. `POM_REGISTRY.md` — POM memory (if exists) — tells you what pages/locators already exist
3. `QANYONE_STATE.md` — Current pipeline state (if exists)

Then load the relevant phase file based on context:
- `QAnyone/qanyone-discuss.md` — Phase 1: Requirements gathering (max 15 questions)
- `QAnyone/qanyone-plan.md` — Phase 2: Technical planning
- `QAnyone/qanyone-execute.md` — Phase 3: Code execution + TC Mode
- `QAnyone/qanyone-onboard.md` — ONBOARD: Import existing project (use when user sends `ONBOARD`)
- `QAnyone/qanyone-verify.md` — (Placeholder for dev projects — not used for automation)

## Commands You Must Recognize

| Command | Action |
|---|---|
| `start` | Begin Full Flow → read qanyone-master → qanyone-discuss |
| `ONBOARD` | Import existing project → read qanyone-onboard.md → scan project → generate QANYONE_STATE.md + POM_REGISTRY.md |
| `NEW TC <ID>` | ADO TC Mode → fetch from ADO (needs ado_configured: true) |
| `NEW TC <ID1> <ID2>` | Multiple ADO TCs → same as above for each |
| `NEW TC <ten-tc>` | Manual TC Mode → ask user for steps, then full auto |
| `POM STATUS` | Print POM_REGISTRY.md summary |
| `TC STATUS` | List implemented test cases |
| `RERUN TC <ten-hoac-ID>` | Re-run specific TC test |
| `CHOT PRD` | Confirm PRD → move Discuss → Plan |
| `CHOT PLAN` | Confirm Plan → move Plan → Execute |
| `ROLLBACK <PHASE>` | Go back to specified phase |

## Core Rules

1. **Follow qanyone-master.md** as the single entry point for ALL requests
2. **NEVER guess locators** — Codegen/Studio only for auth (Phase 1). After auth, **use MCP ONLY**. Writing Node.js/Playwright observe scripts, DOM dump scripts, or any `page.evaluate()` terminal scripts to find locators is **STRICTLY FORBIDDEN** after Phase 1. If MCP tools are not available in the current mode → tell user to switch to Agent mode. Do NOT use any alternative approach.
3. **Auth-first** — no feature POM before auth is verified
4. **Always update POM_REGISTRY.md** when creating/modifying any Page Object
5. **Read POM_REGISTRY.md first** in every new chat session — it's the project memory
6. **Compress context** between phases — don't carry full conversation history
7. **Source tags mandatory** — every locator must have `[FROM CODEGEN]` (auth only), `[FROM MCP]`, or `[FROM USER]`
8. **TC Mode = FULL AUTO** — supports both `NEW TC <ID>` (ADO) and `NEW TC <ten-tc>` (manual). ADO mode: full auto, no questions. Manual mode: ask user to describe steps ONCE, then full auto. If `ado_configured: false`, always use manual mode. Auto-fix test failures up to 5 cycles.
9. **Full Flow mode** — use `ask_questions` tool to interact with user at phase transitions. See qanyone-discuss.md and qanyone-master.md for exact format.
10. **Always update MD files** — after completing any TC or phase, update POM_REGISTRY.md + QANYONE_STATE.md at minimum. See qanyone-execute.md for full list.

## AUTO-RETRY & RESILIENCE — NEVER GIVE UP

When user sends `NEW TC <ID>` or `NEW TC <ten-tc>`, you MUST complete the ENTIRE flow until DONE. No partial work.

### Non-blocking errors → AUTO-RETRY (do NOT stop):
- **Timeout / chunk errors**: Retry with SMALLER chunks (split file into 2-3 parts, write each separately). If writing a full file fails, break it into sections and create/edit piece by piece. NEVER retry with same size — always reduce.
- **Terminal command fails**: Check error, fix, retry
- **File read/write fails**: Retry with correct path. If file too large, read/write in smaller ranges.
- **ADO fetch fails**: Check PAT/network, retry
- **TypeScript compile error**: Fix the code, retry compile
- **Test fails**: Analyze error → fix code → rerun test (up to 3 cycles)
- **MCP tool error**: Fall back to codegen approach
- **Partial output / truncated response**: Continue from where you left off — do NOT restart from scratch

### BLOCKING errors → Only these can STOP you (ask user):
- **Cannot find locators** — codegen/MCP both unavailable AND user hasn't provided them
- **Auth expired** — auth/user.json invalid AND cannot re-auth without user interaction
- **ADO test case not found** — ID does not exist in ADO
- **Missing critical user input** — e.g., app URL unknown, no way to discover

### Recovery behavior:
```
On ANY error:
1. Classify: BLOCKING or NON-BLOCKING?
2. If NON-BLOCKING → fix/retry automatically, do NOT ask user
3. If BLOCKING → explain what's blocked, what user needs to do, then WAIT
4. After user provides info → RESUME from where you stopped (not from scratch)
5. ALWAYS save progress to QANYONE_STATE.md before stopping
```

### Progress checkpointing:
After each completed sub-step in TC Mode, save progress so that if chat breaks:
- User can open new chat
- AI reads QANYONE_STATE.md + POM_REGISTRY.md
- AI knows exactly where to resume
