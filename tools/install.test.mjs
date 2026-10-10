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
