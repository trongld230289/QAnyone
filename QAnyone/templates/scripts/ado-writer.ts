#!/usr/bin/env -S npx tsx
/** Create or update an Azure DevOps test case from "action::expected|action::expected" steps. */
import "dotenv/config";
import { adoEnv, authHeaders, type AdoEnv } from "./fetch-tc";

export type StepIn = { action: string; expected: string };

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** ADO expects HTML inside the XML text, so the HTML wrapper and the text are both XML-escaped. */
export function buildStepsXml(steps: StepIn[]): string {
  const inner = steps
    .map((s, i) => {
      const id = i + 2;
      const type = s.expected ? "ValidateStep" : "ActionStep";
      const cell = (text: string) => esc(`<DIV><P>${esc(text)}</P></DIV>`);
      return (
        `<step id="${id}" type="${type}">` +
        `<parameterizedString isformatted="true">${cell(s.action)}</parameterizedString>` +
        `<parameterizedString isformatted="true">${cell(s.expected)}</parameterizedString>` +
        `<description/></step>`
      );
    })
    .join("");
  return `<steps id="0" last="${steps.length + 1}">${inner}</steps>`;
}

export function parseStepsArg(arg: string): StepIn[] {
  return arg
    .split("|")
    .map((p) => {
      const [action, expected = ""] = p.split("::");
      return { action: action.trim(), expected: expected.trim() };
    })
    .filter((s) => s.action);
}

export async function createTestCase(
  input: { title: string; steps: StepIn[]; userStoryId?: number },
  env: AdoEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const ops: object[] = [
    { op: "add", path: "/fields/System.Title", value: input.title },
    { op: "add", path: "/fields/Microsoft.VSTS.TCM.Steps", value: buildStepsXml(input.steps) },
  ];
  if (input.userStoryId) {
    ops.push({
      op: "add",
      path: "/relations/-",
      value: {
        rel: "Microsoft.VSTS.Common.TestedBy-Reverse",
        url: `${env.org}/${encodeURIComponent(env.project)}/_apis/wit/workItems/${input.userStoryId}`,
      },
    });
  }
  const url = `${env.org}/${encodeURIComponent(env.project)}/_apis/wit/workitems/$Test%20Case?api-version=7.1`;
  const res = await fetchImpl(url, { method: "POST", headers: authHeaders(env.pat), body: JSON.stringify(ops) });
  if (!res.ok) throw new Error(`ADO ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { id: number }).id;
}

export async function updateTestCase(
  id: number,
  steps: StepIn[],
  env: AdoEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const ops = [{ op: "add", path: "/fields/Microsoft.VSTS.TCM.Steps", value: buildStepsXml(steps) }];
  const url = `${env.org}/${encodeURIComponent(env.project)}/_apis/wit/workitems/${id}?api-version=7.1`;
  const res = await fetchImpl(url, { method: "PATCH", headers: authHeaders(env.pat), body: JSON.stringify(ops) });
  if (!res.ok) throw new Error(`ADO ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { id: number }).id;
}

if (process.argv[1] && /ado-writer\.ts$/.test(process.argv[1])) {
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = (k: string): string | undefined => {
    const i = rest.indexOf(k);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const steps = parseStepsArg(arg("--steps") ?? "");
  const usage =
    'usage: ado-writer.ts create --title "<t>" --steps "a::e|a::e" [--us <id>] | update --tc <id> --steps "a::e|..."';
  const run =
    cmd === "create"
      ? createTestCase(
          { title: arg("--title") ?? "", steps, userStoryId: arg("--us") ? Number(arg("--us")) : undefined },
          adoEnv(),
        )
      : cmd === "update"
        ? updateTestCase(Number(arg("--tc")), steps, adoEnv())
        : Promise.reject(new Error(usage));
  run
    .then((id) => console.log(JSON.stringify({ id })))
    .catch((e: Error) => {
      console.error(e.message);
      process.exit(1);
    });
}
