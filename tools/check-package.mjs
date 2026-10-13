// Package lint: required files, size budget, forbidden strings, broken links, BOM/CRLF.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED = [
  "CLAUDE.md", ".github/copilot-instructions.md",
  "QAnyone/core.md", "QAnyone/setup.md", "QAnyone/pipeline.md", "QAnyone/formats.md", "QAnyone/rules.md",
  "QAnyone/setup/index.html", "QAnyone/setup/scaffold.mjs", "QAnyone/setup/record.mjs", "QAnyone/templates/test-case.md",
  "QAnyone/templates/playwright.config.ts", "QAnyone/templates/auth.setup.ts",
  "QAnyone/templates/base.page.ts", "QAnyone/templates/page.template.ts",
  "QAnyone/templates/login.form.page.ts", "QAnyone/templates/login.azure-ad.page.ts", "QAnyone/templates/login.google.page.ts",
  "QAnyone/templates/pages.fixture.ts", "QAnyone/templates/env.ts", "QAnyone/templates/totp.ts", "QAnyone/templates/excel.ts",
  "QAnyone/templates/env.example", "QAnyone/templates/gitignore",
  "QAnyone/templates/mcp.json", "QAnyone/templates/vscode-mcp.json", "QAnyone/templates/playwright-mcp.json",
  "QAnyone/templates/claude-settings.json", "QAnyone/templates/vscode-settings.json",
  "QAnyone/templates/scripts/fetch-tc.ts", "QAnyone/templates/scripts/ado-writer.ts",
];
const BUDGET = {
  "QAnyone/core.md": 11000, "QAnyone/setup.md": 11000, "QAnyone/pipeline.md": 17000,
  "QAnyone/formats.md": 9000, "QAnyone/rules.md": 9000,
};
const TOTAL_BUDGET = 55000;
// Generic patterns live here. Private identifiers (employer names, internal hosts, machine
// paths) go in tools/forbidden.local — one regex per line, git-ignored — so the repo itself
// never carries them.
const FORBIDDEN = [/cypress/i, /waitForTimeout/, /expect\.soft/, /â€/, /Ã/, /\bTODO\b/, /\bTBD\b/, /(READ|SEARCH) `\.env`/];
const LOCAL = join(ROOT, "tools", "forbidden.local");
if (existsSync(LOCAL)) {
  for (const line of readFileSync(LOCAL, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (t && !t.startsWith("#")) FORBIDDEN.push(new RegExp(t, "i"));
  }
}
const SKIP_DIRS = new Set(["node_modules", ".git", "docs", "test-results", "playwright-report", ".superpowers", ".vscode"]);
const TEXT_RE = /\.(md|html|ts|json|example|mjs|sh|yml|yaml)$|\/gitignore$/;

const errors = [];
for (const f of REQUIRED) if (!existsSync(join(ROOT, f))) errors.push(`missing: ${f}`);

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, "/");
const textFiles = walk(ROOT).filter((p) => TEXT_RE.test(rel(p)));

let total = 0;
for (const p of textFiles) {
  const r = rel(p);
  const buf = readFileSync(p);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) errors.push(`BOM: ${r}`);
  const txt = buf.toString("utf8");
  if (txt.includes("\r\n")) errors.push(`CRLF: ${r}`);
  if (!r.startsWith("tools/")) for (const re of FORBIDDEN) if (re.test(txt)) errors.push(`forbidden ${re}: ${r}`);
  if (BUDGET[r] !== undefined) {
    total += txt.length;
    if (txt.length > BUDGET[r]) errors.push(`over budget ${txt.length}>${BUDGET[r]}: ${r}`);
  }
  if (r.endsWith(".md")) {
    for (const m of txt.matchAll(/\]\((?!https?:|#|mailto:)([^)]+)\)/g)) {
      const target = m[1].split("#")[0];
      if (target && !existsSync(resolve(dirname(p), target))) errors.push(`broken link ${m[1]} in ${r}`);
    }
  }
}
if (total > TOTAL_BUDGET) errors.push(`instruction total ${total} > ${TOTAL_BUDGET}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`check-package OK (${textFiles.length} files, instruction chars ${total})`);
