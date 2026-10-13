import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

/** Entries of a .zip archive (an .xlsx is one) by name. Stored and deflated entries, no ZIP64. */
function unzip(buf: Buffer): Map<string, Buffer> {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("not a zip file");
  const files = new Map<string, Buffer>();
  let p = buf.readUInt32LE(end + 16);
  for (let i = buf.readUInt16LE(end + 10); i > 0; i--) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLength = buf.readUInt16LE(p + 28);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLength);
    const local = buf.readUInt32LE(p + 42);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(data) : data);
    p += 46 + nameLength + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return files;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const colIndex = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/**
 * Reads an .xlsx into { sheet name: rows of cell text }. Dates stay Excel serial numbers.
 * No Excel library on purpose: exports written by .NET use prefixed SpreadsheetML
 * (`<x:workbook>`), which exceljs cannot read.
 */
export async function readWorkbook(path: string): Promise<Record<string, string[][]>> {
  const files = unzip(await readFile(path));
  const text = (name: string) => files.get(name)?.toString("utf8").replace(/<(\/?)\w+:/g, "<$1") ?? "";

  const shared = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
  );
  const rels = Object.fromEntries(
    [...text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
      /Id="([^"]+)"/.exec(m[0])![1],
      /Target="([^"]+)"/.exec(m[0])![1].replace(/^\/?(xl\/)?/, "xl/"),
    ]),
  );

  const sheets: Record<string, string[][]> = {};
  for (const m of text("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)) {
    const name = decode(/name="([^"]+)"/.exec(m[0])![1]);
    const id = /r:id="([^"]+)"/.exec(m[0])![1];
    const rows: string[][] = [];
    for (const row of text(rels[id]).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const letters = /r="([A-Z]+)\d+"/.exec(c[1])?.[1];
        const type = /t="(\w+)"/.exec(c[1])?.[1];
        const body = c[2] ?? "";
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? "";
        cells[letters ? colIndex(letters) : cells.length] = type === "s" ? shared[Number(raw)] : decode(raw);
      }
      rows.push(Array.from(cells, (v) => v ?? ""));
    }
    sheets[name] = rows;
  }
  return sheets;
}
