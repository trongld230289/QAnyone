#!/usr/bin/env node
// QAnyone installer: `npx github:trongld230289/QAnyone init [dir] [--force]`
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ITEMS = ["QAnyone", "CLAUDE.md", ".github/copilot-instructions.md"];
const USAGE = `usage: qanyone init [dir] [--force]
  Copies the QAnyone framework (QAnyone/, CLAUDE.md, .github/copilot-instructions.md)
  into <dir> (default: current directory). --force overwrites an existing QAnyone/.`;

const args = process.argv.slice(2);
const cmd = args[0];
const force = args.includes("--force");
const target = resolve(args.slice(1).find((a) => !a.startsWith("--")) ?? process.cwd());

if (cmd !== "init") {
  console.error(USAGE);
  process.exit(cmd === "--help" || cmd === "-h" ? 0 : 2);
}

if (existsSync(join(target, "QAnyone")) && !force) {
  console.error(`QAnyone/ already exists in ${target}. Re-run with --force to overwrite the framework files.`);
  process.exit(1);
}

mkdirSync(target, { recursive: true });
for (const item of ITEMS) {
  const src = join(PKG_ROOT, item);
  const dst = join(target, item);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true, force: true });
}

console.log(`QAnyone installed in ${target}

Next:
  1. Open this folder in GitHub Copilot Chat (Agent mode) or Claude Code.
  2. Type: SETUP
`);
