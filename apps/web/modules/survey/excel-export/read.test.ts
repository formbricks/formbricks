import { describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { SurveyImportInputError } from "@/modules/survey/import/core/errors";
import { openZipArchive } from "@/modules/survey/import/core/zip";
import { SURVEY_IMPORT_SHEET_MAX_CELL_CHARS } from "@/modules/survey/import/limits";
import { EVERY_TEXT_SURVEY } from "@/modules/survey/lib/__fixtures__/every-text-survey";
import { editExcelExport } from "./__fixtures__/edit-sheet";
import { createIcuTranslate } from "./__fixtures__/translate";
import { EXCEL_EXPORT_META_SHEET } from "./format";
import { EXCEL_EXPORT_IMPORT_MAX_TEXT_CHARS } from "./limits";
import { ExcelExportNotRecognizedError, readExcelExport } from "./read";
import { writeExcelExport } from "./write";

const t = createIcuTranslate("en-US");
const exported = () =>
  writeExcelExport({ survey: EVERY_TEXT_SURVEY as unknown as TSurvey, t, locale: "en-US" });
const read = (bytes: Uint8Array) => readExcelExport(openZipArchive(bytes));

/** The workbook with its meta sheet's rows changed by `edit`. */
const editMeta = (bytes: Uint8Array, edit: (rows: string[][]) => string[][] | null): Uint8Array => {
  const book = XLSX.read(bytes, { type: "array" });
  const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[EXCEL_EXPORT_META_SHEET], {
    header: 1,
    raw: false,
    defval: "",
  });
  const next = edit(rows);
  if (next === null) {
    delete book.Sheets[EXCEL_EXPORT_META_SHEET];
    book.SheetNames = book.SheetNames.filter((name) => name !== EXCEL_EXPORT_META_SHEET);
    book.Workbook = { Sheets: [{ Hidden: 0 }] };
  } else {
    book.Sheets[EXCEL_EXPORT_META_SHEET] = XLSX.utils.aoa_to_sheet(next);
  }
  return new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);
};

const refusalOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    if (error instanceof ExcelExportNotRecognizedError) return "not_recognized";
    if (error instanceof SurveyImportInputError) return String(error.invalidParams[0]?.code);
    throw error;
  }
  return undefined;
};

describe("readExcelExport", () => {
  test("reads every row of an export with its key, Question ID, Type and one cell per language", () => {
    const sheet = read(exported());

    expect(sheet.locale).toBe("en-US");
    expect(sheet.surveyId).toBe(EVERY_TEXT_SURVEY.id);
    expect(sheet.languages).toEqual([
      { code: "en", column: 3 },
      { code: "de", column: 4 },
    ]);
    expect(sheet.rows[0]).toEqual({
      row: 2,
      key: "welcomeCard.headline",
      questionId: "",
      type: "Welcome card: Headline",
      cells: new Map([
        ["en", "Welcome"],
        ["de", "Willkommen"],
      ]),
    });
    expect(sheet.rows.find((row) => row.key === "element.open.headline")).toMatchObject({
      questionId: "open",
      type: "Free text",
    });
    expect(sheet.duplicateRows).toEqual([]);
  });

  test("keeps rows added in the sheet, without a key, and leaves out empty ones", () => {
    const sheet = read(
      editExcelExport(exported(), (rows) => [
        ...rows,
        ["", "", "", "", "", ""],
        ["", "new_q", "Free text", "New question?", "", ""],
      ])
    );

    expect(sheet.rows.at(-1)).toEqual({
      row: 3 + sheet.rows.length - 1,
      key: "",
      questionId: "new_q",
      type: "Free text",
      cells: new Map([
        ["en", "New question?"],
        ["de", ""],
      ]),
    });
  });

  test("reads the first of two rows with one key, and names the second", () => {
    const sheet = read(editExcelExport(exported(), (rows) => [...rows, [...rows[1]]]));

    expect(sheet.duplicateRows).toEqual([sheet.rows.length + 2]);
  });

  test("finds columns by their headers, wherever they were moved", () => {
    const sheet = read(
      editExcelExport(exported(), (rows) =>
        rows.map(([key, id, type, en, de, logic]) => [key, de, logic, type, en, id])
      )
    );

    expect(sheet.languages).toEqual([
      { code: "en", column: 4 },
      { code: "de", column: 1 },
    ]);
    expect(sheet.rows.find((row) => row.key === "element.open.headline")).toMatchObject({
      questionId: "open",
      type: "Free text",
    });
  });

  test("refuses a sheet whose cells hold more text than a survey can, counting a repeated string per cell", () => {
    // One long string in thousands of cells costs one shared string in the file, but each cell is copied
    // on its own when the rows leave the worker.
    const long = "x".repeat(SURVEY_IMPORT_SHEET_MAX_CELL_CHARS);
    const rowsNeeded = Math.ceil(EXCEL_EXPORT_IMPORT_MAX_TEXT_CHARS / (2 * long.length)) + 1;
    const bytes = editExcelExport(exported(), (rows) => [
      ...rows,
      ...Array.from({ length: rowsNeeded }, () => ["", "", "Choice 1", long, long, ""]),
    ]);

    expect(bytes.byteLength).toBeLessThan(2 * 1024 * 1024);
    try {
      read(bytes);
      expect.unreachable();
    } catch (error) {
      expect((error as SurveyImportInputError).invalidParams[0]).toMatchObject({
        code: "document_limit_exceeded",
        identifier: "text_size",
      });
    }
  });

  test("tells a workbook that is not an Excel export of a survey apart", () => {
    const plain = new Uint8Array(
      XLSX.write(
        (() => {
          const book = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Question", "Type"]]), "Sheet1");
          return book;
        })(),
        { type: "buffer", bookType: "xlsx" }
      ) as Buffer
    );

    expect(refusalOf(() => read(plain))).toBe("not_recognized");
    expect(refusalOf(() => read(editMeta(exported(), () => null)))).toBe("not_recognized");
    expect(
      refusalOf(() =>
        read(editMeta(exported(), (rows) => rows.map((row, index) => (index === 0 ? ["format", "2"] : row))))
      )
    ).toBe("not_recognized");
    expect(
      refusalOf(() => read(editExcelExport(exported(), (rows) => rows.map(([, ...rest]) => ["", ...rest]))))
    ).toBe("not_recognized");
    // An export written before the meta sheet named its survey.
    expect(refusalOf(() => read(editMeta(exported(), (rows) => rows.slice(0, 5))))).toBe("not_recognized");
  });
});
