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
