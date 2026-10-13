import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { readWorkbook } from "../QAnyone/templates/excel";

/** Minimal zip writer: .rels entries stored, the rest deflated, so both methods are read. */
function zip(files: Record<string, string>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text, "utf8");
    const method = name.endsWith(".rels") ? 0 : 8;
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt32LE(offset, 42);
    parts.push(local, nameBuf, data);
    central.push(entry, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}

// SpreadsheetML as .NET writes it: every element prefixed with `x:`, absolute relationship target.
const PREFIXED = {
  "xl/workbook.xml":
    '<x:workbook xmlns:x="main" xmlns:r="rel"><x:sheets><x:sheet name="Jobs &amp; More" sheetId="1" r:id="rId1"/></x:sheets></x:workbook>',
  "xl/_rels/workbook.xml.rels":
    '<Relationships><Relationship Id="rId1" Type="worksheet" Target="/xl/worksheets/sheet.xml"/></Relationships>',
  "xl/sharedStrings.xml":
    '<x:sst><x:si><x:t>Job</x:t></x:si><x:si><x:r><x:t>Order</x:t></x:r><x:r><x:t xml:space="preserve"> #</x:t></x:r></x:si></x:sst>',
  "xl/worksheets/sheet.xml":
    '<x:worksheet><x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="C1" t="s"><x:v>1</x:v></x:c></x:row>' +
    '<x:row r="2"><x:c r="A2"><x:v>42</x:v></x:c><x:c r="B2" t="inlineStr"><x:is><x:t>a &lt; b</x:t></x:is></x:c><x:c r="C2"/></x:row>' +
    "</x:sheetData></x:worksheet>",
};
const EXPECTED = { "Jobs & More": [["Job", "", "Order #"], ["42", "a < b", ""]] };

async function read(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "qanyone-xlsx-"));
  try {
    const path = join(dir, "book.xlsx");
    writeFileSync(path, zip(files));
    return await readWorkbook(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("reads prefixed SpreadsheetML (.NET export): shared, rich, inline, numeric, empty and skipped cells", async () => {
  assert.deepEqual(await read(PREFIXED), EXPECTED);
});

test("reads plain SpreadsheetML the same way", async () => {
  const plain = Object.fromEntries(Object.entries(PREFIXED).map(([k, v]) => [k, v.replace(/<(\/?)x:/g, "<$1")]));
  assert.deepEqual(await read(plain), EXPECTED);
});

test("rejects a file that is not a zip", async () => {
  const dir = mkdtempSync(join(tmpdir(), "qanyone-xlsx-"));
  const path = join(dir, "not.xlsx");
  writeFileSync(path, "plain text, not a workbook");
  await assert.rejects(readWorkbook(path), /not a zip file/);
  rmSync(dir, { recursive: true, force: true });
});
