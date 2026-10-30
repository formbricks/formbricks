import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import { setDeclaredSizes } from "../core/__fixtures__/zip-builders";
import { SurveyImportFileTooLargeError, SurveyImportInputError } from "../core/errors";
import { openZipArchive } from "../core/zip";
import {
  SURVEY_IMPORT_SHEET_MAX_CELL_CHARS,
  SURVEY_IMPORT_SHEET_MAX_COLUMNS,
  SURVEY_IMPORT_SHEET_MAX_ROWS,
} from "../limits";
import { loadDocumentFixture } from "./__fixtures__/load-fixture";
import { readSheetDocument } from "./read-sheet";

const read = (bytes: Uint8Array) => readSheetDocument(bytes, openZipArchive(bytes));

/** A workbook written by SheetJS: one sheet per entry, each a grid of text rows. */
const workbook = (
  sheets: Record<string, (string | number)[][]>,
  options: { title?: string; hidden?: Record<string, 1 | 2>; edit?: (book: XLSX.WorkBook) => void } = {}
): Uint8Array => {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  }
  if (options.title) book.Props = { Title: options.title };
  if (options.hidden) {
    book.Workbook = {
      Sheets: book.SheetNames.map((name) => ({ name, Hidden: options.hidden?.[name] ?? 0 })),
    };
  }
  options.edit?.(book);
  return new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);
};

/** A workbook's parts with every `from` replaced by `to`: what SheetJS refuses to write itself. */
const patched = (bytes: Uint8Array, from: string, to: string): Uint8Array =>
  zipSync(
    Object.fromEntries(
      Object.entries(unzipSync(bytes)).map(([name, content]) => [
        name,
        name.endsWith(".xml") ? strToU8(strFromU8(content).replaceAll(from, to)) : content,
      ])
    )
  );

const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (error instanceof SurveyImportInputError) return error.invalidParams[0];
    throw error;
  }
  throw new Error("Expected the workbook to be refused");
};

describe("readSheetDocument", () => {
  test("reads a bilingual sheet's compound cells in both languages, word for word", () => {
    const model = read(loadDocumentFixture("library-short.xlsx"));

    expect(model.kind).toBe("xlsx");
    expect(model.skippedParts).toEqual([]);
    expect(model.lines.map((line) => line.key)).toEqual(["R1", "R2", "R3", "R4", "R5"]);
    expect(model.cells.get("C1")).toBe("English Text");
    expect(model.cells.get("C2")).toBe(
      "Which day did you visit?\nChoices: Monday; Tuesday; Wednesday; Thursday; Friday; Saturday; Other"
    );
    expect(model.cells.get("D2")).toContain("الخيارات: الاثنين؛ الثلاثاء؛ الأربعاء");
    // Empty cells are not part of the model, the review columns with text are.
    expect(model.cells.has("G2")).toBe(false);
    expect(model.cells.get("H4")).toBe("Wording approved");
  });

  test("reads a checklist's title row and merged section rows as lines of their own", () => {
    const model = read(loadDocumentFixture("site-audit-checklist.xlsx"));

    expect(model.lines[0]).toEqual({
      key: "R1",
      cells: [{ key: "A1", text: "CITY PARKS  |  SITE AUDIT CHECKLIST" }],
    });
    // A merged range keeps its text in its first cell only.
    expect(model.lines.find((line) => line.key === "R4")?.cells).toEqual([
      { key: "A4", text: "VISIT DETAILS" },
    ]);
    expect(model.cells.get("F7")).toBe("1=North / 2=South");
  });

  test("reads the first sheet only and names the others, never the very hidden ones", () => {
    const model = read(
      workbook(
        {
          Questions: [["Q1", "How old are you?"]],
          Notes: [["Do not import this"]],
          Archive: [["Old questions"]],
          formbricks: [["meta"]],
        },
        { hidden: { Archive: 1, formbricks: 2 } }
      )
    );

    expect(model.lines).toEqual([
      {
        key: "R1",
        cells: [
          { key: "A1", text: "Q1" },
          { key: "B1", text: "How old are you?" },
        ],
      },
    ]);
    expect(model.skippedParts).toEqual(["Notes", "Archive"]);
  });

  test("takes the workbook's Title property as the document's title", () => {
    expect(read(workbook({ Sheet1: [["Q1"]] }, { title: "Visitor survey" })).title).toBe("Visitor survey");
    expect(read(workbook({ Sheet1: [["Q1"]] })).title).toBeNull();
  });

  test("reads a formula cell's value, never its formula", () => {
    const model = read(
      workbook(
        { Sheet1: [["Q1", "placeholder"]] },
        {
          edit: (book) => {
            book.Sheets.Sheet1.B1 = { t: "s", v: "How old are you?", f: 'CONCAT("=HYPERLINK(1)")' };
          },
        }
      )
    );

    expect(model.cells.get("B1")).toBe("How old are you?");
  });

  test("takes exactly the row limit and refuses one row more", () => {
    const rows = (count: number) => Array.from({ length: count }, (_, index) => [`Q${index + 1}`]);

    expect(read(workbook({ Sheet1: rows(SURVEY_IMPORT_SHEET_MAX_ROWS) })).lines).toHaveLength(
      SURVEY_IMPORT_SHEET_MAX_ROWS
    );
    expect(refusal(() => read(workbook({ Sheet1: rows(SURVEY_IMPORT_SHEET_MAX_ROWS + 1) })))).toMatchObject({
      code: "document_limit_exceeded",
      identifier: "rows",
    });
  });

  test("takes exactly the column limit and refuses one column more", () => {
    const row = (count: number) => [Array.from({ length: count }, (_, index) => `c${index}`)];

    expect(read(workbook({ Sheet1: row(SURVEY_IMPORT_SHEET_MAX_COLUMNS) })).lines[0].cells).toHaveLength(
      SURVEY_IMPORT_SHEET_MAX_COLUMNS
    );
    expect(refusal(() => read(workbook({ Sheet1: row(SURVEY_IMPORT_SHEET_MAX_COLUMNS + 1) })))).toMatchObject(
      {
        code: "document_limit_exceeded",
        identifier: "columns",
        name: "file.R1",
      }
    );
  });

  test("takes a cell of exactly the cell limit and refuses one character more", () => {
    // Excel never writes a longer cell, and neither does SheetJS: the long text is patched in.
    const cell = (length: number) =>
      patched(workbook({ Sheet1: [["Q1", "LONG_CELL"]] }), "LONG_CELL", "x".repeat(length));

    expect(read(cell(SURVEY_IMPORT_SHEET_MAX_CELL_CHARS)).cells.get("B1")).toHaveLength(
      SURVEY_IMPORT_SHEET_MAX_CELL_CHARS
    );
    expect(refusal(() => read(cell(SURVEY_IMPORT_SHEET_MAX_CELL_CHARS + 1)))).toMatchObject({
      code: "document_limit_exceeded",
      identifier: "cell_size",
      name: "file.B1",
    });
  });

  test("keeps the addresses of a sheet whose text starts below and right of A1", () => {
    const model = read(workbook({ Sheet1: [[], [], ["", "Q1", "How old are you?"]] }));

    expect(model.lines).toEqual([
      {
        key: "R3",
        cells: [
          { key: "B3", text: "Q1" },
          { key: "C3", text: "How old are you?" },
        ],
      },
    ]);
  });

  test("counts what every part inflates to before SheetJS reads any, whatever the directory declares", () => {
    // A part SheetJS never parses, whose directory claims it is small: 1 MiB of zeros declared as 1 KiB.
    const bombed = zipSync({
      ...unzipSync(workbook({ Sheet1: [["Q1"]] })),
      "xl/media/image1.bin": new Uint8Array(1024 * 1024),
    });
    const lying = setDeclaredSizes(bombed, "xl/media/image1.bin", { uncompressedSize: 1024 });

    expect(() => read(lying)).toThrow(SurveyImportFileTooLargeError);
  });

  test("refuses a workbook whose first sheet has no text as unreadable", () => {
    expect(refusal(() => read(workbook({ Empty: [[""]], Other: [["Q1"]] })))).toMatchObject({
      code: "file_unreadable",
    });
  });
});
