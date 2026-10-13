import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BIN = join(ROOT, "bin", "qanyone.mjs");
const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8" });

test("init copies the package into the target dir", () => {
  const dir = mkdtempSync(join(tmpdir(), "qanyone-init-"));
  const r = run("init", dir);
  assert.equal(r.status, 0, r.stderr);
  for (const f of ["QAnyone/core.md", "QAnyone/setup/index.html", "QAnyone/templates/scripts/fetch-tc.ts", "CLAUDE.md", ".github/copilot-instructions.md"]) {
    assert.ok(existsSync(join(dir, f)), `missing ${f}`);
  }
  assert.equal(readFileSync(join(dir, "QAnyone/core.md"), "utf8"), readFileSync(join(ROOT, "QAnyone/core.md"), "utf8"));
  assert.match(r.stdout, /SETUP/);
  rmSync(dir, { recursive: true, force: true });
});

test("init refuses to overwrite an existing QAnyone/ unless --force", () => {
  const dir = mkdtempSync(join(tmpdir(), "qanyone-init-"));
  assert.equal(run("init", dir).status, 0);
  const again = run("init", dir);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already exists/);
  assert.equal(run("init", dir, "--force").status, 0);
  rmSync(dir, { recursive: true, force: true });
});

test("unknown command exits non-zero with usage", () => {
  const r = run("frobnicate");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /usage/i);
});

test("update refreshes framework files and points to the UPDATE command", () => {
  const dir = mkdtempSync(join(tmpdir(), "qanyone-update-"));
  assert.equal(run("init", dir).status, 0);
  const core = join(dir, "QAnyone", "core.md");
  const { writeFileSync } = require("node:fs");
  writeFileSync(core, "stale");
  const r = run("update", dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(core, "utf8"), readFileSync(join(ROOT, "QAnyone/core.md"), "utf8"));
  assert.match(r.stdout, /UPDATE/);
  rmSync(dir, { recursive: true, force: true });
});

test("init keeps an existing CLAUDE.md and appends the QAnyone block once; update replaces it", () => {
  const { writeFileSync, mkdirSync } = require("node:fs");
  const dir = mkdtempSync(join(tmpdir(), "qanyone-merge-"));
  mkdirSync(join(dir, ".github"), { recursive: true });
  writeFileSync(join(dir, "CLAUDE.md"), "# My project rules\n\nAlways use pnpm.\n");
  writeFileSync(join(dir, ".github", "copilot-instructions.md"), "Team conventions here.\n");
  assert.equal(run("init", dir).status, 0);
  let claude = readFileSync(join(dir, "CLAUDE.md"), "utf8");
  assert.match(claude, /Always use pnpm\./);
  assert.match(claude, /<!-- qanyone:start -->[\s\S]*READ `QAnyone\/core\.md`[\s\S]*<!-- qanyone:end -->/);
  assert.equal(claude.match(/qanyone:start/g).length, 1);
  const copilot = readFileSync(join(dir, ".github", "copilot-instructions.md"), "utf8");
  assert.match(copilot, /Team conventions here\./);
  assert.match(copilot, /qanyone:start/);
  // simulate an older block, then update must replace it, not duplicate it
  writeFileSync(join(dir, "CLAUDE.md"), claude.replace("READ `QAnyone/core.md`", "READ `QAnyone/old.md`"));
  assert.equal(run("update", dir).status, 0);
  claude = readFileSync(join(dir, "CLAUDE.md"), "utf8");
  assert.match(claude, /Always use pnpm\./);
  assert.match(claude, /READ `QAnyone\/core\.md`/);
  assert.doesNotMatch(claude, /old\.md/);
  assert.equal(claude.match(/qanyone:start/g).length, 1);
  rmSync(dir, { recursive: true, force: true });
});

test("update replaces a marker-less CLAUDE.md written by an older installer instead of appending", () => {
  const dir = mkdtempSync(join(tmpdir(), "qanyone-old-"));
  assert.equal(run("init", dir).status, 0);
  const block = readFileSync(join(dir, "CLAUDE.md"), "utf8");
  const inner = block.replace("<!-- qanyone:start -->\n", "").replace("<!-- qanyone:end -->\n", "");
  const { writeFileSync } = require("node:fs");
  writeFileSync(join(dir, "CLAUDE.md"), inner); // what init wrote before markers existed
  const r = run("update", dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /old format replaced/);
  const after = readFileSync(join(dir, "CLAUDE.md"), "utf8");
  assert.equal(after.split("<!-- qanyone:start -->").length - 1, 1);
  assert.equal(after.split("# QAnyone — Playwright E2E automation framework").length - 1, 1, "heading must appear once");
  // a file with the user's own content is still appended to, not replaced
  writeFileSync(join(dir, "CLAUDE.md"), "# My notes\n\nkeep me\n");
  assert.equal(run("update", dir).status, 0);
  const kept = readFileSync(join(dir, "CLAUDE.md"), "utf8");
  assert.match(kept, /^# My notes\n\nkeep me\n\n<!-- qanyone:start -->/);
  rmSync(dir, { recursive: true, force: true });
});

test("init seeds MCP config, approvals and an empty storage state; update keeps them", () => {
  const dir = mkdtempSync(join(tmpdir(), "qanyone-seed-"));
  const r = run("init", dir);
  assert.equal(r.status, 0, r.stderr);
  for (const f of [".mcp.json", ".vscode/mcp.json", "playwright-mcp.json", ".claude/settings.json", ".vscode/settings.json", "playwright/.auth/user.json"]) {
    assert.ok(existsSync(join(dir, f)), `missing ${f}`);
    assert.match(r.stdout, new RegExp(`${f.replace(/[.\/]/g, "\$&")}: created`));
  }
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "playwright/.auth/user.json"), "utf8")), { cookies: [], origins: [] });
  const { writeFileSync } = require("node:fs");
  writeFileSync(join(dir, ".mcp.json"), "{\"mine\":true}");
  const u = run("update", dir);
  assert.equal(u.status, 0, u.stderr);
  assert.equal(readFileSync(join(dir, ".mcp.json"), "utf8"), "{\"mine\":true}", "update must not overwrite user files");
  assert.match(u.stdout, /\.mcp\.json: kept/);
  rmSync(dir, { recursive: true, force: true });
});

// A copy of the package laid out where npx installs it (`<cache>/_npx/<hash>/node_modules/<pkg>`).
function packageCopy(base) {
  const { cpSync } = require("node:fs");
  const pkg = join(base, "node_modules", "qanyone-dev");
  for (const f of ["bin", "QAnyone", "CLAUDE.md", ".github/copilot-instructions.md", "package.json"]) {
    cpSync(join(ROOT, f), join(pkg, f), { recursive: true });
  }
  return join(pkg, "bin", "qanyone.mjs");
}

test("run from the npx cache, the installer deletes that cache entry so the next npx run downloads the latest", () => {
  const tmp = mkdtempSync(join(tmpdir(), "qanyone-npx-"));
  const entry = join(tmp, "_npx", "0123456789abcdef");
  const bin = packageCopy(entry);
  const dir = join(tmp, "project");
  for (const args of [["init", dir], ["update", dir], ["--help"]]) {
    const bin2 = existsSync(bin) ? bin : packageCopy(entry);
    const r = spawnSync(process.execPath, [bin2, ...args], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!existsSync(entry), `npx cache entry still there after ${args[0]}`);
  }
  assert.ok(existsSync(join(dir, "QAnyone", "core.md")));
  rmSync(tmp, { recursive: true, force: true });
});

test("run from anywhere else, the installer deletes nothing", () => {
  const tmp = mkdtempSync(join(tmpdir(), "qanyone-local-"));
  const bin = packageCopy(join(tmp, "plain"));
  const r = spawnSync(process.execPath, [bin, "init", join(tmp, "project")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(bin));
  assert.ok(existsSync(BIN));
  rmSync(tmp, { recursive: true, force: true });
});
