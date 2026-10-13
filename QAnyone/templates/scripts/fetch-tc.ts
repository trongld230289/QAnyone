#!/usr/bin/env -S npx tsx
/** Fetch an Azure DevOps test case and print { id, title, steps } as JSON. */
import "dotenv/config";

export type AdoEnv = { org: string; project: string; pat: string };
export type Step = { index: number; action: string; expected: string };

export function adoEnv(): AdoEnv {
  const get = (k: string): string => {
    const v = process.env[k];
    if (!v) throw new Error(`Missing ${k} in .env`);
    return v;
  };
  return { org: get("ADO_ORG").replace(/\/$/, ""), project: get("ADO_PROJECT"), pat: get("ADO_PAT") };
}

export function authHeaders(pat: string): Record<string, string> {
  return {
    Authorization: "Basic " + Buffer.from(":" + pat).toString("base64"),
    "Content-Type": "application/json-patch+json",
  };
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

/** ADO stores HTML inside XML text, so entities are decoded twice: XML layer, then HTML layer. */
export function htmlToText(html: string): string {
  const decoded = decodeEntities(html);
  const stripped = decoded.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped).replace(/\s+/g, " ").trim();
}

export function parseSteps(xml: string): Step[] {
  const steps: Step[] = [];
  const re = /<step\b[^>]*>([\s\S]*?)<\/step>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const parts = [...m[1].matchAll(/<parameterizedString[^>]*>([\s\S]*?)<\/parameterizedString>/g)].map((p) =>
      htmlToText(p[1]),
    );
    steps.push({ index: steps.length + 1, action: parts[0] ?? "", expected: parts[1] ?? "" });
  }
  return steps;
}

export async function fetchTestCase(id: number, env: AdoEnv, fetchImpl: typeof fetch = fetch) {
  const url = `${env.org}/${encodeURIComponent(env.project)}/_apis/wit/workitems/${id}?api-version=7.1`;
  const res = await fetchImpl(url, { headers: authHeaders(env.pat) });
  if (res.status === 404) throw new Error(`ADO test case ${id} not found`);
  if (!res.ok) throw new Error(`ADO ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { id: number; fields: Record<string, string> };
  return {
    id: json.id,
    title: json.fields["System.Title"] ?? "",
    steps: parseSteps(json.fields["Microsoft.VSTS.TCM.Steps"] ?? ""),
  };
}

if (process.argv[1] && /fetch-tc\.ts$/.test(process.argv[1])) {
  const id = Number(process.argv[2]);
  if (!id) {
    console.error("usage: npx tsx scripts/fetch-tc.ts <id>");
    process.exit(2);
  }
  fetchTestCase(id, adoEnv())
    .then((tc) => console.log(JSON.stringify(tc, null, 2)))
    .catch((e: Error) => {
      console.error(e.message);
      process.exit(1);
    });
}
