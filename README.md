# QAnyone — QA + Anyone · Automation for Everyone

> **Applying CodeGen to Automation Testing.**
> From manual UI recording to Azure DevOps — in a single command.

QAnyone is an AI-driven E2E test-automation framework. It turns a screen
recording (or an existing Azure DevOps test case) into a fully coded,
self-healing Playwright/Cypress test — and publishes the result back to Azure
DevOps. The AI runs the whole pipeline end-to-end, remembers everything it
learns, and gets cheaper and smarter on every run.

**Tech stack:** Playwright / Cypress · GitHub Copilot Agent · MCP Browser ·
Azure DevOps · Self-Healing

---

## Quick Start

1. Copy `.github/` and `QAnyone/` (this whole package) into the root of your project.
2. Open Copilot Chat (or Claude Code) in that project — **Agent mode**.
3. New project → send `start`. Existing project → send `ONBOARD`.
4. After setup, use `NEW TC <ID>` (ADO) or `NEW TC <name>` (manual) to generate test cases.

> Do not edit files inside `QAnyone/` by hand — treat them as the framework core.

---

## How it works — two phases

### 1) Setup — one-time configuration

**Install (once):** copy the `QAnyone/` folder + `.github/copilot-instructions.md`
into your repo. Then pick one of **two entry modes**:

| Mode | Command | What it does |
|---|---|---|
| 🆕 **START** — new project from scratch | `start` | • Guided interview — up to **15 questions**<br>• Captures framework, auth & user flows<br>• **Auth-first**: verified before any feature POM<br>• Generates `QANYONE_STATE.md` + POM registry |
| 📦 **ONBOARD** — import an existing project | `ONBOARD` | • Auto-scans the repo & detects config<br>• Fast path when `QANYONE_STATE.md` already exists<br>• Confirms Base URL, auth & ADO integration<br>• Rebuilds project memory in seconds |

- **2** entry modes · **≤15** setup questions · **1×** one-time config · **Auth** verified first.

### 2) Execute — TC Mode

Run the full test-case pipeline with one command:

```
$ NEW TC <ID / name>
```

The AI runs **A → Z** in three stages, with **zero questions and zero
confirmations**, and self-heals up to **3 retries** on failure.

**① INPUT — pick a mode**
- 🎫 **Fetch TC `<ID>`** — pull an existing case from Azure DevOps.
- 🎥 **Codegen `<name>`** — record UI actions for a brand-new flow.

**② AUTOMATE — same engine (both modes)**
- 🧠 AI agent reads **POM memory**.
- 📄 **POM + Spec** generated with zero-guess locators (MCP).
- 🔁 **Run · Self-heal ×3** — auto-fix failures.

**③ PUBLISH — to Azure DevOps**
- ♻️ **Update TC `<ID>`** — refresh the existing case + push the result.
- ✨ **Create TC `<name>`** — publish a brand-new case to Azure DevOps.

### Live run — the pipeline, step by step

Under the hood a single `NEW TC` runs a 9-stage pipeline. Each stage writes to
project memory so the next run is cheaper.

| # | Stage | What happens |
|---|---|---|
| 1 | **Input** | Fetch TC `<ID>` from ADO, or record a new flow with Codegen |
| 2 | **Reflect** | Analyze & map steps → intent (Given / When / Then) |
| 3 | **POM check** | Read `POM_REGISTRY.md` — reuse cached locators (~0 tokens) |
| 4 | **Discovery** | Locator cascade for missing elements: POM → codegen cache → codegen → MCP |
| 5 | **Update POM** | Save any new locators back to `POM_REGISTRY.md` |
| 6 | **Generate test** | Build the spec from the test case (source of truth) |
| 7 | **Run · Self-heal** | Run the test; auto-fix failures up to ×3 |
| 8 | **Update memory** | Write `POM_REGISTRY.md` + `QANYONE_STATE.md` checkpoint |
| 9 | **Publish** | Update / Create the test case on Azure DevOps |

A typical run looks like this in the terminal:

```console
$ NEW TC 102874
▶ Fetching TC #102874 from Azure DevOps…
✓ 8 test steps parsed from ADO
▶ Reflect — mapping actions → intent (Given / When / Then)
✓ 1 precondition + 7 action steps identified
▶ Reading POM_REGISTRY.md …
✓ 6 / 8 locators already cached   ~0 tokens
▶ Discovery — 2 elements missing on /schedule
· POM miss → codegen cache miss → running codegen (~420t)
✓ 2 new locators captured   [FROM CODEGEN]
▶ Updating SchedulePage POM  (+2 locators)
✓ POM_REGISTRY.md updated
▶ Generating spec → 102874-verify-schedule.spec.ts
✓ Spec synced from test case (source of truth)
▶ Run · attempt 1 / 3 …
✗ 1 failing — selector timeout on "Confirm"
↻ Self-heal — re-resolving locator via getByRole
▶ Run · attempt 2 / 3 …
✓ 8 / 8 steps passed
▶ Writing POM_REGISTRY.md · QANYONE_STATE.md
✓ Memory checkpoint saved — resume anytime
▶ Publish — Update TC #102874 on Azure DevOps
✓ TC #102874 updated · result pushed to ADO
● DONE — zero questions · self-healed ×1 · 8/8 passed
```

---

## Smarter every run — cumulative project memory

Every TC writes to project memory that is **reused for free** next time.

### 🧠 What it remembers (after each TC)
- `POM_REGISTRY.md` — every locator, reused at **~0 tokens**.
- **Codegen + MCP snapshot cache** — page discovery is kept.
- `QANYONE_STATE.md` — progress checkpoint; **resume anytime**.
- Read once at session start → **instant resume**.

### 📈 How it reuses — locator cascade (cheapest first)
1. **POM registry** — ~0 tokens.
2. **Codegen cache** — ~200 tokens.
3. **Fresh codegen** — 200–800 tokens (only when the page is new).
4. **MCP fallback** — 3k–12k tokens (last resort only).

> **90%+** of locators are reused → MCP is rarely needed → **40–55% fewer
> tokens** vs. an MCP-only approach. First TC discovers the pages; every run
> after that reuses memory at ~0 tokens and gets smarter.

---

## Demo — live walkthrough

Watch QAnyone turn a screen recording into a published Azure DevOps test — in
one command:

🎥 Record the UI flow  →  ⚡ Run `NEW TC`  →  ✅ Live on Azure DevOps

---

## Package contents

| Path | Purpose |
|---|---|
| `QAnyone/qanyone-master.md` | Master orchestrator — routing & TC Mode commands |
| `QAnyone/qanyone-discuss.md` | Phase 1 — requirements gathering (≤15 questions) |
| `QAnyone/qanyone-plan.md` | Phase 2 — technical planning |
| `QAnyone/qanyone-execute.md` | Phase 3 — code execution + TC Mode |
| `QAnyone/qanyone-onboard.md` | ONBOARD — import an existing project |
| `QAnyone/qanyone-verify.md` | Verification (placeholder for dev projects) |
| `.github/copilot-instructions.md` | Framework entry point for the AI agent |
| `QANYONE_STATE.md` | Current pipeline state (generated) |
| `POM_REGISTRY.md` | POM memory — locators reused across runs (generated) |
