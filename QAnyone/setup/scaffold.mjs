// SETUP step 3 in one command: builds the project files from qanyone.config.md and the templates.
//   node QAnyone/setup/scaffold.mjs [dir]
// Never overwrites: a file that already exists is kept and reported. One command instead of a
// copy per file, so the IDE asks for approval once (or not at all — `node` is pre-approved).
// npm init / npm i / playwright install and QANYONE_STATE.md stay with the AI (setup.md).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const T = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");
const root = resolve(process.argv[2] ?? process.cwd());
const cfgPath = join(root, "qanyone.config.md");
if (!existsSync(cfgPath)) {
  console.error("qanyone.config.md not found in " + root + " — paste the setup form output first.");
  process.exit(1);
}

// front matter of qanyone.config.md: `key: value`, quoted strings, `[a, b]` lists
function readConfig(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const cfg = {};
  for (const line of (m ? m[1] : "").split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith("[")) v = v.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean);
    else if (v.startsWith('"')) v = JSON.parse(v);
    cfg[kv[1]] = v;
  }
  return cfg;
}
const cfg = readConfig(readFileSync(cfgPath, "utf8"));
const auth = cfg.auth || "none";
const needsAuth = auth !== "none";
const totp = needsAuth && cfg.two_fa === "totp";
const sources = cfg.sources || ["md", "codegen"];
const ado = sources.includes("ado");
const browsers = cfg.browsers || ["chromium"];

const report = [];
function put(rel, content) {
  const dst = join(root, rel);
  if (existsSync(dst)) { report.push("  kept     " + rel); return; }
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, content);
  report.push("  created  " + rel);
}
const tpl = (name) => readFileSync(join(T, name), "utf8");

// playwright.config.ts — uncomment the extra browser projects the config lists
let config = tpl("playwright.config.ts");
for (const b of ["firefox", "webkit"]) {
  if (browsers.includes(b)) config = config.replace(new RegExp('^(\\s*)// (\\{ name: "' + b + '")', "m"), "$1$2");
}
put("playwright.config.ts", config);
put("tsconfig.json", JSON.stringify({
  compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, noEmit: true, skipLibCheck: true, types: ["node"] },
  exclude: ["node_modules", "QAnyone"],   // templates must not be compiled in place
}, null, 2) + "\n");

// code from templates
put("pages/base.page.ts", tpl("base.page.ts"));
put("pages/page.template.ts", tpl("page.template.ts"));
put("fixtures/pages.fixture.ts", tpl("pages.fixture.ts"));
put("helpers/env.ts", tpl("env.ts"));
put("helpers/totp.ts", tpl("totp.ts"));   // always: auth.setup.ts imports it
put("tests/auth.setup.ts", tpl("auth.setup.ts"));
put(".gitignore", tpl("gitignore"));
const LOGIN = { form: "login.form.page.ts", "azure-ad": "login.azure-ad.page.ts", google: "login.google.page.ts" };
put("pages/login.page.ts", tpl(LOGIN[auth] || "login.form.page.ts"));   // okta-auth0 / other / none start from the form
if (ado) {
  put("scripts/fetch-tc.ts", tpl("scripts/fetch-tc.ts"));
  put("scripts/ado-writer.ts", tpl("scripts/ado-writer.ts"));
}

// IDE files — normally seeded by the installer already; created only when missing
put(".mcp.json", tpl("mcp.json"));
put(".vscode/mcp.json", tpl("vscode-mcp.json"));
put("playwright-mcp.json", tpl("playwright-mcp.json"));
put(".claude/settings.json", tpl("claude-settings.json"));
put(".vscode/settings.json", tpl("vscode-settings.json"));

// .env.example keeps only the keys this config needs. A group is a run of comment lines plus
// the key lines under it; a group whose keys are all dropped goes with its comments.
const NEEDED = {
  LOGIN_USERNAME: needsAuth, LOGIN_PASSWORD: needsAuth, TOTP_SECRET: totp,
  ADO_ORG: ado, ADO_PROJECT: ado, ADO_PAT: ado,
};
const VALUE = {
  BASE_URL: cfg.base_url || "", AUTH_REQUIRED: String(needsAuth),
  ADO_ORG: cfg.ado_org || "", ADO_PROJECT: cfg.ado_project || "",
};
function envFile() {
  const out = [];
  let group = [];
  const flush = () => {
    const keys = group.filter((l) => /^[A-Z_]+=/.test(l));
    const kept = keys.filter((l) => NEEDED[l.split("=")[0]] !== false);
    if (!keys.length || kept.length) out.push(...group.filter((l) => !/^[A-Z_]+=/.test(l) || kept.includes(l)));
    group = [];
  };
  let prevKey = false;
  for (const line of tpl("env.example").split(/\r?\n/)) {
    const isKey = /^[A-Z_]+=/.test(line);
    if (line.trim() === "") { flush(); out.push(""); prevKey = false; continue; }
    if (!isKey && prevKey) flush();   // a comment after keys starts a new group
    const k = isKey && line.split("=")[0];
    group.push(k && k in VALUE ? k + "=" + VALUE[k] : line);
    prevKey = isKey;
  }
  flush();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
const env = envFile();
put(".env.example", env);
put(".env", env);   // secret values are empty; the user fills them — never read back by the AI

// registry, test cases, an empty storage state so the MCP server can start before auth exists
put("pom-registry/INDEX.md", "| Page path | Feature | File | Class | Locators |\n|---|---|---|---|---|\n");
put("pom-registry/_shared.md", "# Shared components\n");
put("test-cases/.gitkeep", "");
put("playwright/.auth/user.json", '{"cookies":[],"origins":[]}\n');

const fill = Object.keys(NEEDED).filter((k) => NEEDED[k] && !VALUE[k]);
console.log("QAnyone scaffold in " + root + "\n" + report.join("\n"));
console.log(".env keys to fill: " + (fill.length ? fill.join(" ") : "none"));
