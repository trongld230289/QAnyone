import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSteps, fetchTestCase } from "../QAnyone/templates/scripts/fetch-tc";
import { buildStepsXml, createTestCase, updateTestCase } from "../QAnyone/templates/scripts/ado-writer";

const ENV = { org: "https://dev.azure.com/o", project: "P", pat: "pat" };

test("parseSteps strips html, entities and nested tags", () => {
  const xml = `<steps id="0" last="3">
  <step id="2" type="ValidateStep"><parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;Open &lt;B&gt;Jobs&lt;/B&gt; page&amp;nbsp;&lt;/P&gt;&lt;/DIV&gt;</parameterizedString><parameterizedString isformatted="true">&lt;P&gt;Jobs page&lt;BR&gt;is shown&lt;/P&gt;</parameterizedString><description/></step>
  <step id="3" type="ActionStep"><parameterizedString isformatted="true">Click &quot;Save&quot;</parameterizedString><parameterizedString isformatted="true"></parameterizedString><description/></step>
</steps>`;
  assert.deepEqual(parseSteps(xml), [
    { index: 1, action: "Open Jobs page", expected: "Jobs page is shown" },
    { index: 2, action: 'Click "Save"', expected: "" },
  ]);
});

test("fetchTestCase calls the work item API with basic auth", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const fields = {
      "System.Title": "T",
      "Microsoft.VSTS.TCM.Steps":
        '<steps><step id="2" type="ActionStep"><parameterizedString>A</parameterizedString><parameterizedString>E</parameterizedString></step></steps>',
    };
    return new Response(JSON.stringify({ id: 42, fields }), { status: 200 });
  }) as unknown as typeof fetch;
  const tc = await fetchTestCase(42, ENV, fakeFetch);
  assert.equal(calls[0].url, "https://dev.azure.com/o/P/_apis/wit/workitems/42?api-version=7.1");
  assert.equal(
    (calls[0].init.headers as Record<string, string>).Authorization,
    "Basic " + Buffer.from(":pat").toString("base64"),
  );
  assert.deepEqual(tc, { id: 42, title: "T", steps: [{ index: 1, action: "A", expected: "E" }] });
});

test("buildStepsXml escapes and numbers steps from 2", () => {
  const xml = buildStepsXml([{ action: 'Click "Save" & go', expected: "Saved <ok>" }]);
  assert.match(xml, /<steps id="0" last="2">/);
  assert.match(xml, /<step id="2" type="ValidateStep">/);
  assert.match(xml, /Click &amp;quot;Save&amp;quot; &amp;amp; go/);
  assert.match(xml, /Saved &amp;lt;ok&amp;gt;/);
});

test("createTestCase posts a JSON patch with title, steps and optional US link", async () => {
  let body: any;
  let url = "";
  const fakeFetch = (async (u: string, init: RequestInit) => {
    url = u;
    body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ id: 777 }), { status: 200 });
  }) as unknown as typeof fetch;
  const id = await createTestCase({ title: "T", steps: [{ action: "A", expected: "E" }], userStoryId: 12 }, ENV, fakeFetch);
  assert.equal(id, 777);
  assert.equal(url, "https://dev.azure.com/o/P/_apis/wit/workitems/$Test%20Case?api-version=7.1");
  assert.equal(body.find((o: any) => o.path === "/fields/System.Title").value, "T");
  assert.ok(body.find((o: any) => o.path === "/fields/Microsoft.VSTS.TCM.Steps").value.includes("<steps"));
  const rel = body.find((o: any) => o.path === "/relations/-").value;
  assert.equal(rel.rel, "Microsoft.VSTS.Common.TestedBy-Reverse");
  assert.equal(rel.url, "https://dev.azure.com/o/P/_apis/wit/workItems/12");
});

test("updateTestCase patches steps only", async () => {
  let body: any;
  let url = "";
  let method = "";
  const fakeFetch = (async (u: string, init: RequestInit) => {
    url = u;
    method = init.method!;
    body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ id: 42 }), { status: 200 });
  }) as unknown as typeof fetch;
  await updateTestCase(42, [{ action: "A", expected: "E" }], ENV, fakeFetch);
  assert.equal(method, "PATCH");
  assert.equal(url, "https://dev.azure.com/o/P/_apis/wit/workitems/42?api-version=7.1");
  assert.equal(body.length, 1);
  assert.equal(body[0].path, "/fields/Microsoft.VSTS.TCM.Steps");
});
