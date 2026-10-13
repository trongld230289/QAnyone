// Records a flow like `npx playwright codegen`, but in a maximized window whose page fills it:
// codegen keeps the page at 1280x720 whatever the window size, which is hard to click in.
//   node QAnyone/setup/record.mjs <url> [--load-storage=playwright/.auth/user.json] [--channel=msedge]
// The browser and the Playwright Inspector open; copy the recorded code from the Inspector.
// Closing the browser ends the script.
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!url) {
  console.error("usage: node QAnyone/setup/record.mjs <url> [--load-storage=<file>] [--channel=<chrome|msedge>]");
  process.exit(2);
}

const launchOptions = { headless: false, args: ["--start-maximized"] };
if (opt("channel")) launchOptions.channel = opt("channel");
const contextOptions = { viewport: null }; // no fixed viewport: the page fills the maximized window
if (opt("load-storage")) contextOptions.storageState = opt("load-storage");

const browser = await chromium.launch(launchOptions);
const context = await browser.newContext(contextOptions);
// Closing the last page closes the browser, which ends the script (as codegen does).
context.on("page", (p) => p.on("close", () => context.pages().length || browser.close().catch(() => {})));

// `npx playwright codegen` turns recording on with this internal call (`_enableRecorder` in
// 1.58, `_showRecorder` in 1.64). Its options only shape the generated code, which cannot print
// `viewport: null`, so they get the storage state alone. Without the call, page.pause() opens
// the same Inspector and the user clicks Record.
const startRecorder = context._showRecorder ?? context._enableRecorder;
const codeOptions = contextOptions.storageState ? { storageState: contextOptions.storageState } : {};
let notRecording = "";
try {
  await startRecorder.call(context, { language: "playwright-test", launchOptions: {}, contextOptions: codeOptions, mode: "recording", handleSIGINT: false });
} catch (e) {
  notRecording = e.message.split("\n")[0]; // fall back to page.pause() below
}

const page = await context.newPage();
await page.goto(url).catch((e) => console.log(`Could not open ${url} (${e.message.split("\n")[0]}); type the address in the browser.`));
console.log(notRecording
  ? `Browser open (maximized). Click Record in the Playwright Inspector, do the flow, then copy the code. Close the browser when done. (Recording did not start by itself: ${notRecording})`
  : "Recording in a maximized browser. Do the flow, then copy the code from the Playwright Inspector. Close the browser when done.");
if (notRecording) await page.pause().catch(() => {});
if (browser.isConnected()) await new Promise((done) => browser.on("disconnected", done));
process.exit(0); // also closes an Inspector left open by a recorder that failed to start
