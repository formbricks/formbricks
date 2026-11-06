/**
 * @vitest-environment jsdom
 */
import { describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { editExcelExport } from "@/modules/survey/excel-export/__fixtures__/edit-sheet";
import { createIcuTranslate } from "@/modules/survey/excel-export/__fixtures__/translate";
import { EXCEL_EXPORT_META_SHEET } from "@/modules/survey/excel-export/format";
import { writeExcelExport } from "@/modules/survey/excel-export/write";
import { openZipArchive } from "@/modules/survey/import/core/zip";
import { EVERY_TEXT_SURVEY } from "@/modules/survey/lib/__fixtures__/every-text-survey";
import { isExcelExportArchive, isExcelExportFile } from "./excel-export-file";

const t = createIcuTranslate("en-US");
const exported = () =>
  writeExcelExport({ survey: EVERY_TEXT_SURVEY as unknown as TSurvey, t, locale: "en-US" });
const isExport = (bytes: Uint8Array) => isExcelExportArchive(openZipArchive(bytes));

/** The export with its meta sheet's rows changed by `edit`, written the way another app might save it. */
const editMeta = (
  bytes: Uint8Array,
  edit: (rows: string[][]) => string[][],
  options: XLSX.WritingOptions = { bookSST: true }
): Uint8Array => {
  const book = XLSX.read(bytes, { type: "array" });
  const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[EXCEL_EXPORT_META_SHEET], {
    header: 1,
    raw: false,
    defval: "",
  });
  book.Sheets[EXCEL_EXPORT_META_SHEET] = XLSX.utils.aoa_to_sheet(edit(rows));
  return new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx", ...options }) as Buffer);
};

const workbookOf = (sheets: Record<string, string[][]>): Uint8Array => {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);
};

const setCell = (rows: string[][], row: number, column: number, text: string) =>
  rows.map((cells, index) =>
    index === row ? cells.map((cell, at) => (at === column ? text : cell)) : cells
  );

describe("isExcelExportArchive", () => {
  test("tells an Excel export, as written and as re-saved with its texts edited", () => {
    expect(isExport(exported())).toBe(true);
    expect(isExport(editExcelExport(exported(), (rows) => rows.slice(0, 3)))).toBe(true);
  });

  test("reads the meta sheet whether its texts are shared strings or inline", () => {
    expect(isExport(editMeta(exported(), (rows) => rows, { bookSST: false }))).toBe(true);
  });

  test("tells apart a workbook without the meta sheet, or with a valid one first", () => {
    expect(isExport(workbookOf({ Sheet1: [["Question", "Type"]] }))).toBe(false);
    const book = XLSX.read(exported(), { type: "array" });
    const metaRows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[EXCEL_EXPORT_META_SHEET], {
      header: 1,
      raw: false,
      defval: "",
    });
    expect(isExport(workbookOf({ Questions: [["key"]], [EXCEL_EXPORT_META_SHEET]: metaRows }))).toBe(true);
    expect(isExport(workbookOf({ [EXCEL_EXPORT_META_SHEET]: metaRows, Questions: [["key"]] }))).toBe(false);
  });

  test("tells apart a meta sheet of another format, with a label missing or moved, or no survey id", () => {
    expect(isExport(editMeta(exported(), (rows) => setCell(rows, 0, 1, "2")))).toBe(false);
    expect(isExport(editMeta(exported(), (rows) => setCell(rows, 2, 0, "header")))).toBe(false);
    expect(isExport(editMeta(exported(), (rows) => rows.slice(0, 5)))).toBe(false);
    expect(isExport(editMeta(exported(), (rows) => [rows[1], rows[0], ...rows.slice(2)]))).toBe(false);
    expect(isExport(editMeta(exported(), (rows) => setCell(rows, 5, 1, "")))).toBe(false);
    expect(isExport(editMeta(exported(), (rows) => setCell(rows, 5, 1, "../surveys")))).toBe(false);
  });
});

describe("isExcelExportFile", () => {
  test("reads a picked file, and answers no for one that is not a workbook", async () => {
    expect(await isExcelExportFile(new Blob([exported()]))).toBe(true);
    expect(await isExcelExportFile(new Blob(["not a zip"]))).toBe(false);
  });
});
