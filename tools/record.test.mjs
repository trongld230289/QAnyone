import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RECORD = join(ROOT, "QAnyone", "setup", "record.mjs");

test("record.mjs without a URL prints its usage and exits 2", () => {
  const r = spawnSync(process.execPath, [RECORD], { encoding: "utf8" });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /usage: node QAnyone\/setup\/record\.mjs <url>/);
});
