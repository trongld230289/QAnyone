# QAnyone v2 — Thiết kế

**Ngày:** 2026-10-10
**Trạng thái:** chờ duyệt
**Thay thế:** toàn bộ gói `QAnyone/` + `.github/copilot-instructions.md` hiện tại (v1)

---

## 1. Mục tiêu

QAnyone là một gói hướng dẫn (Markdown + 1 form HTML + template) để AI agent tự viết
automation test **Playwright** cho một web app, chạy trên **GitHub Copilot Chat** và
**Claude Code**. Người dùng là QA/dev không muốn tự viết Playwright.

Test case đi vào từ **3 nguồn**: Azure DevOps, file markdown viết tự do, hoặc ghi lại
thao tác bằng codegen. Cả 3 quy về **1 format markdown chuẩn**, rồi chạy chung một
pipeline: tìm locator → POM → spec → chạy → tự sửa → ghi nhớ.

### Ngoài phạm vi (v2)
- Cypress, Copilot CLI, Claude in Chrome.
- Project test nằm chung repo với source app. Project test **luôn là repo riêng**, AI không
  thấy source app, chỉ thấy app qua trình duyệt.
- Dashboard / báo cáo adoption (v1 "dashboard v3.0").
- Tự commit git, tự push ADO.

### Vì sao viết lại thay vì sửa v1
v1 (~40k token) có 3 file chỉ dẫn mâu thuẫn nhau về cách tìm locator, 2 con số retry khác
nhau, các luật làm hỏng test (chờ cứng để quay video, `expect.soft` quanh locator), gắn
chặt tool của Copilot, 40% nội dung là Cypress, lỗi encoding, và còn tên dự án nội bộ.
Sửa tại chỗ không gỡ được cấu trúc. v2 viết lại cấu trúc, nhưng **gặt lại các luật đã
chứng minh** của v1 qua một danh sách được duyệt (xem §9).

---

## 2. Quyết định đã chốt

| # | Quyết định |
|---|---|
| D1 | Chỉ Playwright. Bỏ Cypress. |
| D2 | Nền tảng: Copilot Chat + Claude Code. Hướng dẫn dùng động từ trừu tượng, 1 bảng ánh xạ tool. |
| D3 | 3 nguồn TC (ADO · md tự do · codegen) → 1 file chuẩn / 1 TC trong `test-cases/`. |
| D4 | File md đầu vào chấp nhận format tự do; AI chuẩn hoá và hỏi xác nhận 1 lần. |
| D5 | Project test là repo riêng, scaffold từ thư mục trống. |
| D6 | Câu hỏi setup qua **form HTML thuần** (`QAnyone/setup/index.html`), Generate → 1 ô markdown → paste vào chat. Không server, không Node. |
| D7 | Form chỉ hỏi hướng, không hỏi secret. Secret điền vào `.env` sau khi scaffold; AI chỉ kiểm tra tên biến. |
| D8 | Một lệnh `SETUP` thay cho `start` + `ONBOARD`, tự rẽ nhánh. |
| D9 | Discovery locator luôn bằng **Playwright MCP** (`--storage-state` dùng chung auth với test). |
| D10 | POM registry chia theo feature: `pom-registry/INDEX.md` + `_shared.md` + `<feature>.md`. |
| D11 | Self-heal tối đa 3 vòng, có danh sách hành động bị cấm. |
| D12 | `PUSH ADO` là lệnh riêng, luôn có preview + xác nhận. |
| D13 | File hướng dẫn trong gói viết bằng **tiếng Anh** (AI đọc ổn định, ít token). Ngôn ngữ của nội dung TC và báo cáo theo config (`language`). |

---

## 3. Cấu trúc

### 3.1 Gói QAnyone (chép vào root repo test)

```
CLAUDE.md                        thin: "Read QAnyone/core.md before anything."
.github/copilot-instructions.md  nội dung y hệt CLAUDE.md
QAnyone/
├── core.md        lệnh, routing, luật cứng, bảng ánh xạ nền tảng          (~2.5k token)
├── setup.md       SETUP: scaffold / onboard / resume, auth-first            (~2k)
├── pipeline.md    NEW TC 9 bước, RERUN TC, STATUS, PUSH ADO                 (~4k)
├── formats.md     format TC md, pom-registry, QANYONE_STATE, qanyone.config (~2k)
├── rules.md       luật chất lượng: locator, action, assertion, self-heal    (~2k)
├── setup/
│   └── index.html form câu hỏi; HTML+JS inline, không CDN, mở offline từ file://
└── templates/
    ├── test-case.md
    ├── playwright.config.ts
    ├── auth.setup.ts            login → storageState (form / Azure AD / Google có flow mẫu)
    ├── base.page.ts · page.template.ts · pages.fixture.ts
    ├── env.ts · totp.ts
    ├── env.example · gitignore · mcp.json · vscode-mcp.json
    └── scripts/ fetch-tc.ts · ado-writer.ts   (code thật, dùng ADO REST API, PAT từ .env)
```

Tổng hướng dẫn ≈ 12–13k token. Mỗi yêu cầu AI đọc `core.md` + 1 file ngữ cảnh
(`setup.md` hoặc `pipeline.md`) + `rules.md`/`formats.md` khi tới bước cần ≈ 6–7k.

### 3.2 Repo test sau `SETUP` (theo convention docs Playwright)

```
playwright.config.ts      baseURL · projects: setup + chromium (+firefox/webkit nếu chọn)
                          use.storageState nếu có login · trace: on-first-retry · video: retain-on-failure
package.json · .env (gitignored) · .env.example · .gitignore
.mcp.json · .vscode/mcp.json     @playwright/mcp headed, --storage-state=playwright/.auth/user.json
playwright/.auth/user.json       gitignored
tests/
├── auth.setup.ts                project "setup"; các project khác dependencies: ['setup']
└── <feature>/<id>-<slug>.spec.ts
pages/   base.page.ts · login.page.ts · <name>.page.ts
fixtures/pages.fixture.ts        test.extend() cấp page object cho spec
helpers/ env.ts · totp.ts (nếu TOTP)
scripts/ fetch-tc.ts · ado-writer.ts (chỉ khi có ADO)
test-cases/<id>-<slug>.md        source of truth
pom-registry/ INDEX.md · _shared.md · <feature>.md
QANYONE_STATE.md · qanyone.config.md
QAnyone/ · CLAUDE.md · .github/copilot-instructions.md
```

Quy ước POM: 1 class / 1 page, locator `readonly` khai báo trong constructor, method là hành
vi nghiệp vụ, **không assertion trong POM**. Chạy test: `npx playwright test <id>` từ root
(repo riêng nên không còn vấn đề CWD).

---

## 4. Lệnh

| Lệnh | Việc |
|---|---|
| `SETUP` | Thiết lập lần đầu / import project có sẵn / resume — tự phát hiện |
| `NEW TC <ADO id>` · `NEW TC <path.md>` · `NEW TC <tên>` | Tạo test từ ADO / file md / codegen. Nhiều id cách nhau bởi dấu cách. |
| `RERUN TC <id>` | Chạy lại 1 test (đọc lại TC md; nếu md đổi → sinh lại spec trước) |
| `STATUS` | Phase, TC đã có + trạng thái, số POM/locator theo feature |
| `PUSH ADO <id>` | Tạo hoặc cập nhật TC trên ADO, có preview + xác nhận |

Bỏ: `start`, `ONBOARD`, `CHOT PRD`, `CHOT PLAN`, `ROLLBACK`, `TC STATUS`, `POM STATUS`.

Routing trong `core.md`: mọi chat mới → READ `QANYONE_STATE.md` (nếu có) trước. Lệnh không
khớp → trả lời ngắn, gợi ý bảng lệnh. Không tự làm việc ngoài lệnh.

---

## 5. SETUP

### 5.1 Rẽ nhánh
```
SETUP
├── không có playwright.config.ts            → SCAFFOLD (5.2)
├── có config, không có QANYONE_STATE.md     → ONBOARD (5.3)
└── có QANYONE_STATE.md                      → ASK 1 câu: Resume / Scan lại / Xem STATUS
```

### 5.2 SCAFFOLD (repo trống)
```
1. AI: "Mở QAnyone/setup/index.html, điền, bấm Generate, paste kết quả vào đây."
2. User paste → WRITE qanyone.config.md. Từ đây không hỏi thêm.
3. Scaffold theo config (không hỏi):
   RUN  npm init -y · npm i -D @playwright/test dotenv · npx playwright install <browsers>
   WRITE playwright.config.ts, pages/base.page.ts, fixtures/pages.fixture.ts, helpers/env.ts
         (+ helpers/totp.ts nếu 2FA=TOTP), tests/, test-cases/, pom-registry/INDEX.md,
         .env.example (đúng biến cần), .gitignore, .mcp.json, .vscode/mcp.json,
         scripts/ (chỉ khi có ADO), QANYONE_STATE.md (phase: setup)
4. Nếu có login hoặc ADO → AI: "Điền .env rồi gõ OK." → kiểm tra tên biến, không đọc giá trị.
5. Auth-first (chỉ khi có login):
   a. Locator trang login: BROWSER (MCP) navigate baseURL → snapshot → generate_locator.
      Azure AD / Google: dùng flow mẫu trong templates/auth.setup.ts.
      MCP không có → RUN BACKGROUND codegen, user tự login, paste code (chỗ duy nhất cần codegen ở SETUP).
   b. WRITE pages/login.page.ts + tests/auth.setup.ts
   c. RUN npx playwright test --project=setup → kiểm tra playwright/.auth/user.json
      + smoke: goto baseURL không bị đẩy về login.
   d. STATE auth_ready: true. Nhắc user restart MCP server để nhận storage state.
6. Không login → smoke: goto baseURL, title hiện.
7. STATE phase: ready → "Setup xong. Dùng NEW TC <ADO id | path.md | tên>."
```

### 5.3 ONBOARD (repo Playwright có sẵn)
```
1. Scan không hỏi: playwright.config.ts (baseURL, projects, storageState) · pages/*.ts (class, method)
   · tests/**/*.spec.ts (describe/test) · .env (tên biến) · playwright/.auth/*.json (có? tuổi?)
2. AI đưa link form điền sẵn qua query string:
   QAnyone/setup/index.html?baseUrl=…&auth=…&twoFa=…&sources=…&ado=…&browsers=…
   User xác nhận → Generate → paste → WRITE qanyone.config.md
3. Reconcile: pom-registry/ từ pages/ (tag [FROM USER], chưa verify) · danh sách TC từ specs
   · QANYONE_STATE.md. Không ghi đè config/cấu trúc có sẵn. Thiếu (vd. không có project setup,
   không có fixture) → báo và đề nghị thêm, user gõ OK mới thêm.
4. Có login mà .auth thiếu/cũ → chạy 5.2 bước 5c.
```

### 5.4 Form `setup/index.html`

| # | Câu hỏi | Kiểu | Điều kiện |
|---|---|---|---|
| 1 | Base URL | text | luôn |
| 2 | Login? kiểu nào | 1 trong: none · form · azure-ad · google · okta-auth0 · other(text) | luôn |
| 3 | 2FA | 1 trong: none · totp · sms · push · unknown | Q2 ≠ none |
| 4 | Có TOTP secret? | yes · no | Q3 = totp |
| 5 | Nguồn TC | nhiều: ado · md · codegen | luôn |
| 6 | ADO org URL + project | text | Q5 có ado |
| 7 | Browsers | nhiều: chromium (mặc định) · firefox · webkit | luôn |
| 8 | Test data | existing · self-create-cleanup · seed · unknown | luôn |
| 9 | Ngôn ngữ TC/báo cáo | vi · en | luôn |
| 10 | Ghi chú về app (SPA, iframe, shadow DOM, loading, popup…) | textarea | tuỳ chọn |
| + | Thêm câu hỏi/trả lời của bạn | nút "+", không giới hạn | tuỳ chọn |

- Ẩn/hiện theo điều kiện bằng JS. Điền sẵn từ query string (ONBOARD). Secret không bao giờ
  đi qua URL hay form.
- Generate → 1 textarea chứa `qanyone.config.md` (frontmatter YAML Q1–Q9 + `## Notes` gồm
  Q10 và các cặp tự thêm) + nút Copy.
- Không CDN, không font ngoài; mở offline từ `file://`.

---

## 6. Pipeline `NEW TC`

```
0. PRECHECK   STATE phase=ready · auth_ready nếu có login · MCP có sẵn (nếu không → báo cách bật, dừng)
1. INTAKE     số + ado      → RUN scripts/fetch-tc.ts <id> → title + steps
              path.md       → READ, format tự do, có thể n TC
              tên           → RUN BACKGROUND npx playwright codegen <baseURL> --load-storage=playwright/.auth/user.json
                              → user click → ASK paste code → parse steps + locators
2. NORMALIZE  → test-cases/<id>-<slug>.md (format §7.1). id: ADO id · id trong file md · TC-<n> kế tiếp.
              ⏸ CONFIRM 1 lần, chỉ nguồn md/codegen: in bảng Steps → user gõ OK hoặc sửa file rồi OK.
                Nguồn ADO không confirm. Nhiều TC → confirm 1 lần cho cả lô.
3. MAP        steps → page(s) · READ pom-registry/INDEX.md + file feature liên quan + _shared.md
              → danh sách element còn thiếu
4. DISCOVER   chỉ cho element thiếu, thứ tự: registry → Locators trong TC md (codegen) → MCP snapshot
              từng page → MCP generate_locator từng element. Mọi locator có tag.
              Trùng tên trên nhiều row → scope theo row/container; không rõ ngữ cảnh → ASK (BLOCKING).
5. POM        WRITE/EDIT pages/<name>.page.ts · đăng ký fixture · EDIT pom-registry/<feature>.md + INDEX.md
6. SPEC       WRITE tests/<feature>/<id>-<slug>.spec.ts từ TC md:
              describe `<id> <title>` + tag · mỗi step TC = 1 test.step() · action → POM method
              hoặc locator inline · Expected → expect() thật · Test Data → const block
7. RUN        RUN npx playwright test <id> → fail → SELF-HEAL ≤ 3 vòng theo rules.md
              hết vòng / nghi app bug / TC sai → status: blocked, kèm trace + screenshot
8. MEMORY     EDIT pom-registry · QANYONE_STATE.md (tcs, current) · frontmatter TC md (status, spec, last_run, heal_count)
9. REPORT     bảng: steps · locator reuse/mới · heal · kết quả · đường dẫn HTML report
```

- Sau mỗi bước ghi `current_tc` + `current_step` vào STATE → chat mới resume đúng chỗ.
- Lỗi không chặn (timeout ghi file, compile, lệnh fail) → tự sửa/retry, ghi file quá dài thì
  chia nhỏ. Lỗi chặn (auth hết hạn không tự login được, ADO id không tồn tại, không thể lấy
  locator) → ghi STATE, báo rõ cần gì, dừng.

### `RERUN TC <id>`
READ TC md → nếu md mới hơn spec → chạy lại bước 3–6 → RUN → MEMORY → REPORT.

### `PUSH ADO <id>`
```
Yêu cầu ado_configured. Nguồn ADO → update steps + Automation Status trên TC có sẵn.
Nguồn md/codegen → tạo TC mới (ASK User Story id, cho phép trống) → nhận ADO id → đổi tên
TC md + spec + describe theo ADO id → cập nhật STATE, registry "Used by".
Luôn in preview bảng steps → ASK xác nhận 1 lần → RUN scripts/ado-writer.ts.
```

---

## 7. Format file

### 7.1 `test-cases/<id>-<slug>.md`
```markdown
---
id: 102874                 # ADO id | TC-001
title: Search job by keyword
source: ado | md | codegen
source_ref: ado:102874 | docs/tc-search.md | codegen:2026-10-10
feature: jobs              # → tests/jobs/, pom-registry/jobs.md
page: /jobs
tags: [regression]
status: draft | confirmed | passing | failed | blocked
spec: tests/jobs/102874-search-job.spec.ts
last_run: 2026-10-10
heal_count: 0
---
## Steps
| # | Action | Expected |
|---|---|---|
| 1 | [Pre] Logged in, on home page | |
| 2 | Click link "Jobs" | Jobs page is displayed |
| 3 | Fill "{{keyword}}" into "Search", press Enter | |
| 4 | Verify results table | Table contains "{{keyword}}" |

## Test Data
| Key | Value | Note |
|---|---|---|
| keyword | QA | |

## Locators
| Element | Locator | Source |
|---|---|---|
| Jobs link | getByRole('link', { name: 'Jobs' }) | [FROM CODEGEN] |

## Notes
```
Luật Steps: step 1 là `[Pre]`; 1 step = 1 hành động; động từ cố định
`Click · Fill · Check · Uncheck · Select · Press · Navigate · Upload · Verify`; element gọi bằng
tên hiển thị trong ngoặc kép, không code; giá trị động `{{key}}` khai báo ở Test Data; ngôn ngữ
theo config.

### 7.2 `pom-registry/`
```
INDEX.md     | Page path | Feature | File | Class | #locators |   (1 dòng / page)
_shared.md   nav, header, login, dialog dùng chung
<feature>.md ## <ClassName> · pages/<file> · <path>
             | Element | Locator | Source | Used by |
             ### Methods  goto() · search(keyword) · …
```
AI đọc INDEX + file feature của TC (từ `feature:`/`page:`) + `_shared.md`. Page chưa có trong
INDEX → tạo trong file feature của TC.

### 7.3 `QANYONE_STATE.md`
```yaml
phase: setup | ready
auth: none | form | azure-ad | google | okta-auth0 | other
auth_ready: false
auth_updated: 2026-10-10
sources: [ado, md, codegen]
ado_configured: false
browsers: [chromium]
language: vi
current_tc: null
current_step: null        # 1-intake … 9-report
tcs:
  102874: passing
  TC-001: blocked
```

### 7.4 `qanyone.config.md`
Frontmatter YAML Q1–Q9 (`base_url, auth, two_fa, totp_secret_available, sources, ado_org,
ado_project, browsers, test_data, language`) + `## Notes`. Đọc ở SETUP; sau đó STATE là nguồn chính.

Bỏ so với v1: `CODEGEN_CACHE.md`, `MCP_SNAPSHOT_CACHE.md` (gộp vào Locators của TC + registry),
`PRD.md`, `SPECS.md`, `PLAN.md`.

---

## 8. Nền tảng và luật chất lượng

### 8.1 Bảng ánh xạ (trong `core.md`)
| Động từ | Copilot Chat | Claude Code |
|---|---|---|
| ASK | `ask_questions` | `AskUserQuestion` |
| RUN | `run_in_terminal` | `Bash` |
| RUN BACKGROUND | `run_in_terminal` + `isBackground: true` | `Bash` + `run_in_background` |
| READ / WRITE / EDIT | `read_file` / `create_file` / `replace_string_in_file` | `Read` / `Write` / `Edit` |
| SEARCH | `file_search` / `grep_search` | `Glob` / `Grep` |
| BROWSER | `mcp_playwright_browser_*` | `mcp__playwright__browser_*` |
| File chỉ dẫn | `.github/copilot-instructions.md` | `CLAUDE.md` |
| Config MCP | `.vscode/mcp.json` | `.mcp.json` |

Chỉ 3 chỗ ASK: SETUP khi đã có state · CONFIRM sau NORMALIZE · preview PUSH ADO. Mỗi ASK có
đường vòng "sửa file rồi gõ OK".

MCP: `npx @playwright/mcp@latest --storage-state=playwright/.auth/user.json`, headed.
SETUP ghi cả 2 file config MCP.

### 8.2 `rules.md`
**Locator** — không đoán; nguồn hợp lệ: registry → codegen → MCP; mỗi locator có tag
`[FROM MCP]/[FROM CODEGEN]/[FROM USER]`; ưu tiên `getByRole > getByLabel > getByPlaceholder >
getByText > getByTestId > CSS`; trùng tên → scope theo row/container, không `.nth()` trừ khi TC
nói "dòng thứ N"; không viết script Node/`page.evaluate` để dump DOM.

**Action** — `Check/Uncheck` → `.check()/.uncheck()`; chờ bằng `expect().toBeVisible()` /
`waitForURL()`; **không `waitForTimeout`** ở bất cứ đâu; iframe → `frameLocator`; dialog →
`page.on('dialog')`; upload → `setInputFiles`; download → `waitForEvent('download')`; drag-drop
HTML5 fail → dispatch events thủ công. (Bảng known-hard patterns của v1 giữ nguyên.)

**Assertion** — mỗi Expected → ≥ 1 `expect()` thật; không `expect.soft`, không `try/catch`
quanh locator; POM không assertion.

**Self-heal (≤ 3)** — được: sửa locator qua MCP, sửa chờ, sửa động từ, sửa data. Cấm: nới/xoá
assertion, `waitForTimeout`, bỏ step, `test.skip/fixme`, đổi Expected. Hết vòng hoặc nghi app
bug → `blocked` + trace + screenshot; không gọi là fixed.

**Vận hành** — chỉ đọc file cần cho bước hiện tại; ghi STATE sau mỗi bước; chat mới đọc STATE
trước; ghi file quá dài → chia nhỏ, không retry cùng kích thước; không commit, không tự push ADO;
không ghi secret vào md/chat; `.env` luôn trong `.gitignore`.

---

## 9. Cách triển khai (hướng 3 — viết lại, gặt luật có kiểm soát)

1. **Dọn bảo mật trước:** xoá `my-org/my-project` trong `qanyone-discuss.md` và quét lại
   toàn bộ repo bằng danh sách từ khoá mở rộng (tên org ADO, tên app, hostname). Viết lại
   lịch sử + force push như đã làm.
2. **Harvest list:** quét 7 file v1, lập `docs/superpowers/specs/2026-10-10-v1-harvest.md` —
   mỗi luật đáng giữ 1 dòng, kèm nguồn `file:line`, cột "đi đâu trong v2". User duyệt.
3. Viết gói v2 theo §3–§8, tick từng luật trong harvest list đã port.
4. Xoá file v1. Cập nhật `README.md` + `QAnyone_README.html` theo lệnh và luồng mới.
5. **Kiểm thử gói:** tạo repo trống, chạy `SETUP` → `NEW TC` 3 nguồn trên một app public
   không login (ví dụ demo Playwright `https://demo.playwright.dev/todomvc`) bằng Claude Code,
   rồi lặp lại bằng Copilot Chat. Ghi kết quả vào README (phần Demo).

Kế hoạch chi tiết từng task sẽ do bước writing-plans lập sau khi spec này được duyệt.

---

## 10. Rủi ro còn lại

- `browser_generate_locator` của `@playwright/mcp` cần bật capability `testing`; nếu phiên bản
  không có → fallback suy locator từ snapshot theo ưu tiên ở §8.2 (self-heal sẽ bắt lỗi unique).
- Copilot Chat có thể giới hạn độ dài paste; config md ngắn (< 2 KB) nên không ảnh hưởng.
- Form mở từ `file://`: query string hoạt động trên Chrome/Edge/Firefox; không dùng `fetch`.
- Azure AD có thể bật MFA bắt buộc không TOTP → auth-first dừng ở BLOCKING, báo rõ.
