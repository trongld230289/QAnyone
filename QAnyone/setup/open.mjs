// Opens the setup form in the default browser, with an optional query string (Onboard prefill).
//   node QAnyone/setup/open.mjs
//   node QAnyone/setup/open.mjs "?baseUrl=https://app.example.com&auth=form&browsers=chromium"
// Always prints the URL so the user can open it by hand if no browser appears.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const query = (process.argv[2] ?? "").replace(/^\?+/, "");
const url = pathToFileURL(join(here, "index.html")).href + (query ? "?" + query : "");

// The OS shell drops "?query" from file: URLs (Windows does), so a prefilled link goes through a
// tiny launcher page in the temp folder that redirects to the full URL.
let target = url;
if (query) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  target = join(tmpdir(), "qanyone-setup-open.html");
  writeFileSync(target, `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${esc(url)}">
<title>QAnyone setup</title><p>Opening the setup form… <a href="${esc(url)}">click here if nothing happens</a></p>\n`);
}

const [cmd, args] =
  process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", target]]
  : process.platform === "darwin" ? ["open", [target]]
  : ["xdg-open", [target]];

const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
child.on("error", (e) => console.log(`Could not start a browser (${e.message}). Open this yourself:\n${url}`));
child.on("spawn", () => console.log(`Setup form opened in your browser:\n${url}`));
child.unref();
