import { describe, expect, test } from "vitest";
import * as xlsx from "xlsx";
import { readZip } from "./__fixtures__/read-zip";
import { XLSX_LIMITS, XlsxLimitError, createXlsxWorkbook } from "./xlsx-writer";

const build = async (
  sheets: { name: string; header: string[]; rows: (string | number | null)[][] }[]
): Promise<Buffer> => {
  const workbook = createXlsxWorkbook();
  for (const sheet of sheets) {
    const writer = workbook.addSheet(sheet.name, sheet.header);
    for (const row of sheet.rows) writer.addRow(row);
  }
  return workbook.toBuffer();
};

const readBack = (buffer: Buffer) => xlsx.read(buffer, { type: "buffer", cellText: false, raw: true });

describe("createXlsxWorkbook", () => {
  test("a sheet reads back with its name, header and rows", async () => {
    const buffer = await build([
      { name: "Codes", header: ["a", "b"], rows: [["x", 1]] },
      { name: "Unmapped values", header: ["c"], rows: [] },
    ]);
    const book = readBack(buffer);
    expect(book.SheetNames).toEqual(["Codes", "Unmapped values"]);
    expect(xlsx.utils.sheet_to_json(book.Sheets.Codes, { header: 1 })).toEqual([
      ["a", "b"],
      ["x", 1],
    ]);
    expect(xlsx.utils.sheet_to_json(book.Sheets["Unmapped values"], { header: 1 })).toEqual([["c"]]);
  });

  test("text stays text: 007, 01 and 98 are strings, numbers are numbers", async () => {
    const buffer = await build([
      {
        name: "Codes",
        header: ["code", "n"],
        rows: [
          ["007", 7],
          ["01", 1.5],
        ],
      },
    ]);
    const sheet = readBack(buffer).Sheets.Codes;
    expect(sheet.A2).toMatchObject({ t: "s", v: "007" });
    expect(sheet.B2).toMatchObject({ t: "n", v: 7 });
    expect(sheet.A3).toMatchObject({ t: "s", v: "01" });
    expect(sheet.B3).toMatchObject({ t: "n", v: 1.5 });
  });

  test("blank cells are not written", async () => {
    const buffer = await build([{ name: "S", header: ["a", "b", "c"], rows: [["x", null, "z"]] }]);
    const sheet = readBack(buffer).Sheets.S;
    expect(sheet.B2).toBeUndefined();
    expect(sheet.C2.v).toBe("z");
  });

  test("keeps Arabic, line breaks, quotes and XML special characters in a cell", async () => {
    const text = "أحمر\nline 2 <b> & \"quoted\" 'single'";
    const buffer = await build([{ name: "S", header: ["a"], rows: [[text]] }]);
    expect(readBack(buffer).Sheets.S.A2.v).toBe(text);
  });

  test("a leading space or line break survives, and control characters Excel refuses are dropped", async () => {
    const buffer = await build([{ name: "S", header: ["a"], rows: [["  padded\u0001\u0008"]] }]);
    expect(readBack(buffer).Sheets.S.A2.v).toBe("  padded");
  });

  test("a text that starts like a formula is written defanged as text, and numbers are untouched", async () => {
    const buffer = await build([{ name: "S", header: ["=h"], rows: [["=SUM(A1)", -3]] }]);
    const sheet = readBack(buffer).Sheets.S;
    expect(sheet.A1.v).toBe("'=h");
    expect(sheet.A2).toMatchObject({ t: "s", v: "'=SUM(A1)" });
    expect(sheet.B2).toMatchObject({ t: "n", v: -3 });
  });

  test("the header row is frozen, filtered, has no merged cells, and no colour carries meaning", async () => {
    const buffer = await build([
      {
        name: "S",
        header: ["a", "b"],
        rows: [
          ["x", "y"],
          ["z", "w"],
        ],
      },
    ]);
    const files = Object.fromEntries(
      readZip(buffer).map((entry) => [entry.name, entry.data.toString("utf8")])
    );
    const sheetXml = files["xl/worksheets/sheet1.xml"];
    expect(sheetXml).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(sheetXml).toContain('<autoFilter ref="A1:B3"/>');
    expect(sheetXml).not.toContain("mergeCell");
    expect(files["xl/styles.xml"]).not.toMatch(/fgColor|bgColor|<color /);
  });

  test("a sheet with only a header still filters that header", async () => {
    const buffer = await build([{ name: "S", header: ["a", "b"], rows: [] }]);
    const sheetXml = readZip(buffer)
      .find((entry) => entry.name === "xl/worksheets/sheet1.xml")
      ?.data.toString("utf8");
    expect(sheetXml).toContain('<autoFilter ref="A1:B1"/>');
  });

  test("text over Excel's 32,767 character cell limit is cut so the file still opens", async () => {
    const buffer = await build([{ name: "S", header: ["a"], rows: [["x".repeat(40000)]] }]);
    expect(String(readBack(buffer).Sheets.S.A2.v)).toHaveLength(32767);
  });

  test("refuses more rows or columns than Excel can hold, instead of writing a broken file", () => {
    expect(XLSX_LIMITS).toEqual({ rows: 1_048_576, columns: 16_384 });
    const tight = createXlsxWorkbook({ limits: { rows: 3, columns: 2 } });
    expect(() => tight.addSheet("S", ["a", "b", "c"])).toThrow(XlsxLimitError);
    const writer = tight.addSheet("T", ["a"]);
    writer.addRow(["1"]);
    writer.addRow(["2"]);
    expect(() => writer.addRow(["3"])).toThrow(XlsxLimitError);
  });

  test("counts every cell position, blank or not, header included, for a size cap", () => {
    const workbook = createXlsxWorkbook();
    const writer = workbook.addSheet("S", ["a", "b"]);
    writer.addRow(["x", null]);
    expect(workbook.cellCount()).toBe(4);
  });

  test("refuses a sheet name Excel rejects", () => {
    const workbook = createXlsxWorkbook();
    expect(() => workbook.addSheet("a/b", ["a"])).toThrow(/sheet name/i);
    expect(() => workbook.addSheet("x".repeat(32), ["a"])).toThrow(/sheet name/i);
  });
});
