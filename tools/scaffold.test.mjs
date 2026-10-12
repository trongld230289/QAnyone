import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAFFOLD = join(ROOT, "QAnyone", "setup", "scaffold.mjs");
const run = (dir) => spawnSync(process.execPath, [SCAFFOLD, dir], { encoding: "utf8" });
const project = (front) => {
  const dir = mkdtempSync(join(tmpdir(), "qanyone-scaffold-"));
  writeFileSync(join(dir, "qanyone.config.md"), "---\n" + front + "\n---\n## Notes\n");
  return dir;
};
const keys = (text) => text.split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => l.split("=")[0]);

test("form login + TOTP + ADO + firefox: all files, only the needed .env keys, prefilled values", () => {
  const dir = project([
    'base_url: "https://shop.example.com"', "auth: form", "two_fa: totp", "totp_secret_available: true",
    "sources: [ado, md, codegen]", 'ado_org: "https://dev.azure.com/acme"', 'ado_project: "Shop"',
    "browsers: [chromium, firefox]", "language: en",
  ].join("\n"));
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  for (const f of ["playwright.config.ts", "tsconfig.json", "pages/base.page.ts", "pages/page.template.ts", "pages/login.page.ts",
    "fixtures/pages.fixture.ts", "helpers/env.ts", "helpers/totp.ts", "tests/auth.setup.ts", ".gitignore",
    "scripts/fetch-tc.ts", "scripts/ado-writer.ts", ".mcp.json", ".vscode/mcp.json", ".vscode/settings.json", ".claude/settings.json",
    "playwright-mcp.json", ".env.example", ".env", "pom-registry/INDEX.md", "pom-registry/_shared.md", "test-cases/.gitkeep",
    "playwright/.auth/user.json"]) assert.ok(existsSync(join(dir, f)), "missing " + f);
  const env = readFileSync(join(dir, ".env"), "utf8");
  assert.deepEqual(keys(env), ["BASE_URL", "AUTH_REQUIRED", "HEADLESS", "TRACE", "VIDEO", "SCREENSHOT", "VIEWPORT",
    "LOGIN_USERNAME", "LOGIN_PASSWORD", "TOTP_SECRET", "ADO_ORG", "ADO_PROJECT", "ADO_PAT"]);
  assert.match(env, /^BASE_URL=https:\/\/shop\.example\.com$/m);
  assert.match(env, /^AUTH_REQUIRED=true$/m);
  assert.match(env, /^ADO_ORG=https:\/\/dev\.azure\.com\/acme$/m);
  assert.match(env, /^LOGIN_PASSWORD=$/m);
  const cfg = readFileSync(join(dir, "playwright.config.ts"), "utf8");
  assert.match(cfg, /^\s*\{ name: "firefox"/m);
  assert.match(cfg, /\/\/ \{ name: "webkit"/);
  assert.equal(readFileSync(join(dir, "pages/login.page.ts"), "utf8"), readFileSync(join(ROOT, "QAnyone/templates/login.form.page.ts"), "utf8"));
  assert.match(r.stdout, /\.env keys to fill: LOGIN_USERNAME LOGIN_PASSWORD TOTP_SECRET ADO_PAT$/m);
  rmSync(dir, { recursive: true, force: true });
});

test("public app, no ADO: no login / 2FA / ADO keys and their comments, nothing to fill", () => {
  const dir = project(['base_url: "https://demo.example.com"', "auth: none", "sources: [md, codegen]", "browsers: [chromium]", "language: vi"].join("\n"));
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  const env = readFileSync(join(dir, ".env.example"), "utf8");
  assert.deepEqual(keys(env), ["BASE_URL", "AUTH_REQUIRED", "HEADLESS", "TRACE", "VIDEO", "SCREENSHOT", "VIEWPORT"]);
  assert.doesNotMatch(env, /--- only when|LOGIN|ADO_|TOTP/);
  assert.match(env, /^AUTH_REQUIRED=false$/m);
  assert.ok(!existsSync(join(dir, "scripts/fetch-tc.ts")));
  assert.match(r.stdout, /\.env keys to fill: none$/m);
  rmSync(dir, { recursive: true, force: true });
});

test("never overwrites: a second run keeps every file, including the user's .env", () => {
  const dir = project(['base_url: "https://demo.example.com"', "auth: form", "two_fa: none", "sources: [md, codegen]"].join("\n"));
  assert.equal(run(dir).status, 0);
  writeFileSync(join(dir, ".env"), "LOGIN_USERNAME=me\n");
  writeFileSync(join(dir, ".vscode/settings.json"), '{ "editor.tabSize": 2 }\n');
  const again = run(dir);
  assert.equal(again.status, 0, again.stderr);
  assert.doesNotMatch(again.stdout, /created/);
  assert.match(again.stdout, /kept {5}\.vscode\/settings\.json/);
  assert.equal(readFileSync(join(dir, ".env"), "utf8"), "LOGIN_USERNAME=me\n");
  rmSync(dir, { recursive: true, force: true });
});

test("no qanyone.config.md: exits 1 with a message", () => {
  const dir = mkdtempSync(join(tmpdir(), "qanyone-scaffold-"));
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /qanyone\.config\.md not found/);
  rmSync(dir, { recursive: true, force: true });
});
