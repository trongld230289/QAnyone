#!/usr/bin/env node
// QAnyone installer:
//   npx github:trongld230289/QAnyone init   [dir] [--force]   first install
//   npx github:trongld230289/QAnyone update [dir]             refresh framework files
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Instruction files are merged: an existing CLAUDE.md / copilot-instructions.md keeps its
// own content and gets the QAnyone block between markers; update replaces only that block.
const POINTERS = ["CLAUDE.md", ".github/copilot-instructions.md"];
const START = "<!-- qanyone:start -->";
const END = "<!-- qanyone:end -->";
const USAGE = `usage: qanyone init [dir] [--force]
       qanyone update [dir]
  init    copies QAnyone/ into <dir> (default: current directory) and adds the QAnyone block
          to CLAUDE.md and .github/copilot-instructions.md (existing content is kept).
          --force overwrites an existing QAnyone/.
  update  overwrites QAnyone/ and refreshes the QAnyone block in the instruction files, then
          tells you to type UPDATE in the chat so the AI syncs the generated files.`;

const args = process.argv.slice(2);
const cmd = args[0];
const force = args.includes("--force");
const target = resolve(args.slice(1).find((a) => !a.startsWith("--")) ?? process.cwd());

if (cmd !== "init" && cmd !== "update") {
  console.error(USAGE);
  process.exit(cmd === "--help" || cmd === "-h" ? 0 : 2);
}

const installed = existsSync(join(target, "QAnyone"));
if (cmd === "init" && installed && !force) {
  console.error(`QAnyone/ already exists in ${target}. Use "update" to refresh it, or "init --force" to overwrite.`);
  process.exit(1);
}
if (cmd === "update" && !installed) {
  console.error(`No QAnyone/ in ${target}. Run "init" first.`);
  process.exit(1);
}

mkdirSync(target, { recursive: true });
cpSync(join(PKG_ROOT, "QAnyone"), join(target, "QAnyone"), { recursive: true, force: true });

function mergePointer(rel) {
  const block = `${START}\n${readFileSync(join(PKG_ROOT, rel), "utf8").trim()}\n${END}\n`;
  const dst = join(target, rel);
  mkdirSync(dirname(dst), { recursive: true });
  if (!existsSync(dst)) {
    writeFileSync(dst, block);
    return "created";
  }
  const current = readFileSync(dst, "utf8");
  const s = current.indexOf(START);
  const e = current.indexOf(END);
  if (s >= 0 && e > s) {
    writeFileSync(dst, current.slice(0, s) + block.trimEnd() + current.slice(e + END.length));
    return "QAnyone section updated (your own content kept)";
  }
  // A file written by an older installer (no markers) holds only the QAnyone text: replace it
  // instead of appending a second copy. Any other content is the user's and is kept.
  if (looksLikeQAnyoneOnly(current)) {
    writeFileSync(dst, block);
    return "QAnyone section updated (old format replaced)";
  }
  writeFileSync(dst, current.trimEnd() + "\n\n" + block);
  return "QAnyone section added after your own content";
}

function looksLikeQAnyoneOnly(text) {
  const t = text.trim();
  return t.startsWith("# QAnyone") && t.includes("READ `QAnyone/core.md`") && t.split("\n").length <= 15;
}

// Files the IDE must see before the first chat (MCP server config, approvals, an empty storage
// state so the MCP server can start). Created when missing, never overwritten: the chat UPDATE
// command merges changes into them.
const SEED = [
  [".mcp.json", "QAnyone/templates/mcp.json"],
  [".vscode/mcp.json", "QAnyone/templates/vscode-mcp.json"],
  ["playwright-mcp.json", "QAnyone/templates/playwright-mcp.json"],
  [".claude/settings.json", "QAnyone/templates/claude-settings.json"],
  [".vscode/settings.json", "QAnyone/templates/vscode-settings.json"],
  ["playwright/.auth/user.json", null],
];
function seed([rel, src]) {
  const dst = join(target, rel);
  if (existsSync(dst)) return `  ${rel}: kept`;
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, src ? readFileSync(join(PKG_ROOT, src), "utf8") : '{"cookies":[],"origins":[]}\n');
  return `  ${rel}: created`;
}

const notes = [...POINTERS.map((p) => `  ${p}: ${mergePointer(p)}`), ...SEED.map(seed)].join("\n");

if (cmd === "update") {
  console.log(`QAnyone updated in ${target}
  QAnyone/: framework files replaced
${notes}

Next:
  1. Open this folder in GitHub Copilot Chat (Agent mode) or Claude Code.
  2. Type: UPDATE   (the AI syncs playwright.config.ts, .env.example, helpers and scripts
                     with the new templates, keeping your values and locators)
`);
} else {
  console.log(`QAnyone installed in ${target}
  QAnyone/: framework files copied
${notes}

Next:
  1. Open this folder in GitHub Copilot Chat (Agent mode) or Claude Code.
  2. Type: SETUP
`);
}
