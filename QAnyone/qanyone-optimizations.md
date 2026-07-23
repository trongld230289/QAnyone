---
name: qanyone-optimizations
description: "Central optimization rules store (Rules 1-8) for QAnyone token efficiency."
goal: "Central optimization rules store (Rules 1-8)"
status: active
last_action: "2026-07-05 â€” Phase 5: Rule 8 appended + YAML + TOC added"
files_modified: ["QAnyone/qanyone-optimizations.md"]
next_step: "Continue to Phase 6: Retry Optimization"
token_estimate: "~520t"
---

## Sections
- [Rule 1: Codegen-First Locator Cascade](#rule-1-codegen-first-locator-cascade)
- [Rule 2: Per-Element MCP Fallback](#rule-2-per-element-mcp-fallback)
- [Rule 3: Cache Refresh Strategy](#rule-3-cache-refresh-strategy)
- [Rule 4: Source Tag Format](#rule-4-source-tag-format)
- [Rule 5: Test Case Generation](#rule-5-test-case-generation)
- [Rule 6: Spec Generation from Test Case](#rule-6-spec-generation-from-test-case)
- [Rule 7: MCP Snapshot Cache](#rule-7-mcp-snapshot-cache)
- [Rule 8: Instruction Compression Verification](#rule-8-instruction-compression-verification)

# QAnyone Optimizations

Central rules for QAnyone token optimizations â€” each phase appends its rules here.

**Phase 1:** Codegen-First Locator Discovery | **Phase 2:** Test Case Generation
**Last updated:** 2026-07-04

---

## Rule 1: Codegen-First Locator Cascade

Before running MCP for any page, check POM_REGISTRY.md â†’ CODEGEN_CACHE.md â†’ run codegen first. MCP is per-element fallback only.

| Priority | Method | Token Cost | When |
|----------|--------|-----------|------|
| 1 (best) | POM_REGISTRY.md | ~0 tokens | Page already has POM with locators |
| 2 | CODEGEN_CACHE.md | ~200 tokens | Codegen already run for this page |
| 3 | Codegen | ~200â€“800 tokens | New page / cache expired |
| 3.5 | MCP_SNAPSHOT_CACHE.md | ~0 tokens | Snapshot already cached for this page |
| 4 (fallback) | MCP (per-element) | ~3,000â€“12,000 tokens | Codegen cannot capture specific element |

**Rationale:** 40â€“55% token reduction: codegen (200â€“800t) vs full-page MCP (3,000â€“12,000t).

---

## Rule 2: Per-Element MCP Fallback

Fallback is per-element, not per-page. A page may have 15 elements from codegen + 2 from MCP.

**Detection:** Rule-based by element type against KNOWN_FALLBACK_LIST.

| Element Type | Action |
|-------------|--------|
| shadow-root | USE MCP |
| canvas | USE MCP |
| iframe | USE MCP |
| svg | USE MCP |
| web-component | USE MCP |
| dynamic-content | USE MCP |
| All others | KEEP CODEGEN |

**Rationale:** 90%+ locators from codegen even on complex pages â€” only uncapturable elements use MCP.

---

## Rule 3: Cache Refresh Strategy

Cache refresh is on-test-failure only â€” NOT TTL-based.

- Cache persists across AI sessions (CODEGEN_CACHE.md)
- Re-codegen triggered by locator-related test failure only
- Cache entry fields: VALID/STALE status, `page_changed` flag
- Manual force: user sends "refresh locators"
- On re-codegen: update timestamp + locator list

---

## Rule 4: Source Tag Format

Every locator in POM must include source tag with inline token cost estimate.

**Format:**
```
// [FROM CODEGEN ~Nt]   â€” codegen-derived locator
// [FROM MCP ~Nt]       â€” MCP-derived locator
// [FROM USER]           â€” user-provided locator (no token cost)
```

**Token estimation formula:**
- Codegen: `len(output_text) / 4` chars-to-tokens, rounded to nearest 50. Floor: ~50t minimum.
- MCP: estimated from `browser_snapshot()` output size, rounded to nearest 500.
- Per-locator: total / count, same rounding rules.

**Placement:** Per-element, inline on the locator declaration line.

---

Rules implemented in `QAnyone/qanyone-execute.md` LOCATOR DISCOVERY. `CODEGEN_CACHE.md` provides cache infrastructure.
Future phases append rules under `## Rule N`.

---

## Rule 5: Test Case Generation

After codegen cached and POM updated (Buoc 5), AI generates a structured test case artifact from raw recorded script.

**Format:** ADO-compatible test case markdown per test-cases/README.md. Key decisions:
- D-01: YAML frontmatter mirrors ADO fields (System.Title, System.Tags, System.Description)
- D-02: Gherkin-light steps â€” Given/When/Then for multi-step flows, Actionâ†’Expected for single steps
- D-03: Separate ## UI Elements Map section listing locators with source tags and priority

**Trigger:** Automatic generation as Buoc 5.5 in QAnyone-execute.md:
- Condition: CODEGEN_CACHE.md has raw script for the page AND test-cases/{page}.md does not exist
- Source: Raw recorded script from CODEGEN_CACHE.md entry
- Output: test-cases/{page-path-slug}.md with ADO-compatible structure
- Dependency: Synchronous before Buoc 6 (spec writing) â€” Phase 3 reads the test case file

**Token cost:** ~500â€”1,000 tokens per test case (AI reasoning to reverse-engineer behavior from codegen script). Negligible compared to MCP snapshot costs (~3,000â€”12,000 tokens).

**Key rules:**
1. Steps describe BEHAVIOR, not CODE â€” never include locator syntax, function calls, or framework terms
2. Each discrete user action = 1 test step (fill, click, select are separate steps)
3. UI Elements Map preserves source tags ([FROM CODEGEN ~Nt] / [FROM MCP ~Nt]) and priority from 4-tier cascade
4. MCP fallback locators get Priority: Low and âš ï¸ annotation
5. Skip non-user actions (scroll, waitForTimeout, framework internals)
6. Generate with current timestamp; re-generate when CODEGEN_CACHE entry refreshes

---

## Rule 6: Spec Generation from Test Case

After test case .md exists (Buoc 5.5 / Rule 5), AI generates executable spec file (.spec.ts / .cy.ts) via template-driven generation with framework adaptation.

**Trigger:** Automatic as Buoc 6 in QAnyone-execute.md:
- Condition: test-cases/{page}.md exists
- Source: Test case .md (frontmatter + Test Steps + UI Elements Map)
- Output: Spec file at FRAMEWORK CONFIG MAP spec_naming + spec_extension
- Dependency: Synchronous after Buoc 5.5, before Buoc 7

**Token cost:** ~500â€”1,500 tokens per spec (AI reasoning to parse, transform, adapt). Negligible compared to MCP snapshot costs (~3,000â€”12,000 tokens).

**Spec template structure (per D-03, D-09):**

```
describe('{Page}')         â† Top-level: page/feature name from YAML
  describe('{Flow 1}')     â† One per ## Flow N in test case
    test('Steps X-Y: ...') â† One per flow, AI-synthesized summary
      â†’ action steps with assertions
  describe('{Flow 2}')
    test('Steps Z: ...')
      â†’ action steps with assertions
  describe('Default Flow') â† Standalone steps (D-11)
    test('...')
      â†’ standalone steps
```

**Key decisions implemented:**
- D-01: 1 test case = 1 spec file
- D-05: Hybrid locator â€” POM methods preferred, inline from UI Elements Map fallback
- D-06: No source tags in spec files â€” clean runtime code
- D-08: Separate test data section at top of spec
- D-12: Hybrid naming â€” flow name = describe(), AI-synthesized summary = test() name
- D-13: Smart assertions on state-changing actions
- D-16: Hybrid assertion type â€” soft within flow, hard between flows
- D-17: Framework-agnostic â†’ adapt to {framework} syntax
- D-22: Verification step (Buoc 6.5) after generation

**Framework adaptation (D-17):** Spec generated in framework-agnostic form (= Playwright syntax), then rewritten to target framework using mapping tables in FRAMEWORK CONFIG MAP (qanyone-master.md):
- Locator API Mapping Table: `page.getByRole(...)` â†” `cy.findByRole(...)`
- Assertion API Mapping Table: `expect(locator).toBeVisible()` â†” `cy.get(selector).should('be.visible')`

**Sync strategy (D-20, D-23):**
1. Test case is source of truth â€” spec always derived from test case
2. Initial generation automatic in Buoc 6
3. Updates: manual trigger â€” generate `{file}.v2.{ext}`, show diff, user approves
4. Buoc 6.5 verification: structural comparison (flows, steps, assertions, locators, test data)
5. Max 2 regeneration attempts on verification failure before flagging user

---

## Rule 7: MCP Snapshot Cache

Cache MCP accessibility tree snapshots to avoid redundant browser_snapshot() calls. Creates Priority 3.5 in locator cascade â€” checked after codegen, before live MCP.

**Storage:** `MCP_SNAPSHOT_CACHE.md` at project root â€” follows CODEGEN_CACHE.md pattern (per-URL entries, metadata + locator tables).

| Priority | Method | Token Cost | When |
|----------|--------|-----------|------|
| 1 (best) | POM_REGISTRY.md | ~0 tokens | Page already has POM with locators |
| 2 | CODEGEN_CACHE.md | ~200 tokens | Codegen already run for this page |
| 3 | Codegen | ~200â€“800 tokens | New page / cache expired |
| 3.5 | MCP_SNAPSHOT_CACHE.md | ~0 tokens | Snapshot already cached for this page |
| 4 (fallback) | MCP (per-element) | ~3,000â€“12,000 tokens | Codegen cannot capture specific element |

**Cache-hit source tag:** `[FROM MCP CACHE ~0t]` â€” distinct from live MCP tag `[FROM MCP ~Nt]`

**Token savings per cache hit:** 3,000â€“12,000 tokens (browser_navigate + browser_snapshot both skipped).

**Key decisions:**
- D-01: Per-page entries â€” one cache entry per URL path, combined snapshot per entry
- D-02: One browser_snapshot per page entry â€” extract ALL MCP elements from it
- D-03: Re-snapshot on change â€” when new element triggers MCP for cached page, re-do full snapshot
- D-04: StorageState checksum as auth hash â€” SHA-256 of auth storage file content, first 8 chars
- D-05: Path-only URL matching â€” query params stripped for broader cache hits
- D-06: Concatenated key format: `{pathname}#{auth_hash}` for readability and debuggability
- D-07: Check before navigate â€” cache hit skips BOTH browser_navigate and browser_snapshot
- D-08: Coupled invalidation â€” when CODEGEN_CACHE refreshes for a page, also invalidate MCP cache
- D-09: LRU eviction at 20 entries â€” oldest captured timestamp removed first
- D-10: Mapped locators only â€” no raw accessibility tree snapshots stored
- D-11: Table format â€” metadata header + locator rows per entry
- D-12: Live MCP fallback on runtime failure â€” self-healing with page_changed: true

**Cache invalidation:**
- `page_changed: true` set on: locator-related test failure OR coupled invalidation from CODEGEN_CACHE refresh
- On `page_changed: true`: next MCP fallback forces fresh browser_navigate + browser_snapshot
- After fresh snapshot and test pass: set `page_changed` back to `false`
- Manual trigger: user sends "refresh locators" for a page
- LRU eviction: at 20 entries, oldest captured timestamp entry removed on addition of new entry

---

## Rule 8: Instruction Compression Verification

After compressing any QAnyone file, AI MUST self-verify these 6 items before marking the file as done:

| # | Check | Pass Criteria |
|---|-------|---------------|
| 1 | Auth details preserved | All auth paths, file names, auth flow commands unchanged |
| 2 | Framework version intact | @playwright/test, cypress, version references in CONFIG MAP verbatim |
| 3 | Base URL present | BASE_URL reference still present, not abbreviated or removed |
| 4 | Locator priorities maintained | Priority cascade tables: POM > CODEGEN_CACHE > Codegen > MCP |
| 5 | All Buoc steps present | Count Buoc steps before/after compression â€” must match |
| 6 | No code blocks corrupted | All ``` fences intact, no truncated code blocks |

**Action on failure:** Revert compression on affected section and retry with narrower scope.

---

## Rule 9: Retry Optimization

Reduce token waste from retry loops â€” terminal states, 5â†’3 retries, adaptive chunk-splitting.

### Terminal States:
Every retry loop PHAI ket thuc voi:
```
[RETRY STATE: SUCCESS] â€” <task> hoan thanh
[RETRY STATE: FAILED] â€” Category: <CATEGORY> | Action: <mo ta> | Next: <buoc tiep theo>
```

### Error Categories & Fix Actions:
| Category | Fix |
|---|---|
| TIMEOUT | Retry voi CHUNK NHO HON â€” adaptive split |
| CHUNK_ERROR | Chia nho hon nua â€” giam 50% size |
| TEST_FAIL | Phan tich error log â†’ fix â†’ rerun (toi da 3 vong) |
| COMPILE_ERROR | Fix syntax/type â†’ recompile |
| AUTH_EXPIRED | Kich hoat re-auth flow â†’ retry |
| MCP_ERROR | Fallback sang codegen |
| TOOL_ERROR | Kiem tra tool availability â†’ retry |

### Adaptive Chunk-Splitting:
```
Small file (<100 lines):    Thu tao toan bo file
Medium file (100-500):      Chia 2 phan â€” create_file + replace/append
Large file (>500 lines):    Chia 3-4 phan nho hon
Quy tac: KHONG retry cung size, LUON giam.
```

### Retry Reduction:
- Test fail retry: 5 â†’ **3 vong**
- Non-blocking errors: auto-retry, KHONG hoi user
- Blocking errors: output `[RETRY STATE: FAILED]` â†’ hoi user

**Implementation:** `QAnyone/qanyone-master.md` â€” AUTO-RETRY & RESILIENCE | `QAnyone/qanyone-execute.md` â€” AUTO-RETRY + XU LY KHI BI BLOCK

---

## Rule 10: Token Budget System

> **Sync note:** thresholds + recovery table mirrored in `QAnyone/qanyone-master.md` TOKEN BUDGET SYSTEM (kept duplicated on purpose so each file loads standalone) â€” update both together.

Token consumption transparency + proactive budget management â€” 200K context window.

### Token Estimation:
- ~4 chars/token for English, ~3 chars/token for Vietnamese
- Per-section estimates in TOCs
- Formula: `tokens_per_task = total_estimate / max(completed_tasks, 1)`

### Tiered Budget:
| Level | Threshold | Action |
|---|---|---|
| Normal | <70% | No action |
| Warning | 70% | Notify user, plan compression |
| Compress | 80% | Strip verbose, condense prose |
| Aggressive | 90% | Purge history, strip non-essential, save + restart |
| Emergency | 99% | Save state, restart with minimal context |

### Tracking Fields (in `.planning/STATE.md`):
```yaml
token_usage:
  total_estimate: <cumulative>
  budget_percent: <% of 200K>
  per_phase: []
  per_task: []
  completed_tasks: <count>
  tokens_per_task: <estimate / tasks>
```

### Recovery Procedures:
| Level | Procedure |
|---|---|
| Warning | Log budget status, plan compression next transition |
| Compress | Run compression rules (Rule 8), update estimates |
| Aggressive | Save STATE.md, restart with qanyone-master.md + STATE.md + PLAN.md only |
| Emergency | Save STATE.md (status: saved), restart fresh with qanyone-master.md + STATE.md + PROJECT.md |

**Implementation:** `QAnyone/qanyone-master.md` â€” TOKEN BUDGET SYSTEM | `QAnyone/qanyone-execute.md` â€” TOKEN TRACKING | `.planning/STATE.md` â€” token_usage frontmatter
