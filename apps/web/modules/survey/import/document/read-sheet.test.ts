import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, test, vi } from "vitest";
import * as XLSX from "xlsx";
import { editLocalHeader, setDeclaredSizes, setFlags } from "../core/__fixtures__/zip-builders";
import { SurveyImportFileTooLargeError, SurveyImportInputError } from "../core/errors";
import { openZipArchive } from "../core/zip";
import {
  SURVEY_IMPORT_SHEET_MAX_CELL_CHARS,
  SURVEY_IMPORT_SHEET_MAX_COLUMNS,
  SURVEY_IMPORT_SHEET_MAX_ROWS,
  SURVEY_IMPORT_XML_MAX_DEPTH,
} from "../limits";
import { loadDocumentFixture } from "./__fixtures__/load-fixture";
import { columnName } from "./model";
import { readSheetDocument } from "./read-sheet";

const read = (bytes: Uint8Array) => readSheetDocument(openZipArchive(bytes));

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

  test("sizes the read from the cells the sheet holds, not the range its dimension declares", () => {
    // Every row holds one cell and the dimension claims Excel's widest range: read as declared, each of
    // the 5,000 rows would be padded to 16,384 cells, about 1 GB from a 37 KB file.
    const rows = Array.from({ length: SURVEY_IMPORT_SHEET_MAX_ROWS }, (_, index) => [`Q${index + 1}`]);
    const declaredWide = patched(
      workbook({ Sheet1: rows }),
      `<dimension ref="A1:A${SURVEY_IMPORT_SHEET_MAX_ROWS}"/>`,
      `<dimension ref="A1:XFD${SURVEY_IMPORT_SHEET_MAX_ROWS}"/>`
    );
    expect(strFromU8(unzipSync(declaredWide)["xl/worksheets/sheet1.xml"])).toContain("A1:XFD");
    const toRows = vi.spyOn(XLSX.utils, "sheet_to_json");

    try {
      expect(read(declaredWide).lines).toHaveLength(SURVEY_IMPORT_SHEET_MAX_ROWS);
      const readRows = toRows.mock.results[0]?.value as string[][];
      expect(Math.max(...readRows.map((row) => row.length))).toBe(1);
    } finally {
      toRows.mockRestore();
    }
  });

  test("visits only the cells a sheet holds, not every slot up to its widest one", () => {
    // 20,000 rows, each with only an error cell at column XFD: walked slot by slot, 327 million visits.
    // Written as XML: SheetJS would fill every slot of the 20,000 × 16,384 range to write it.
    const rows = 20_000;
    const errorRows = Array.from(
      { length: rows - 1 },
      (_, index) => `<row r="${index + 2}"><c r="XFD${index + 2}" t="e"><v>#N/A</v></c></row>`
    ).join("");
    const base = workbook({ Sheet1: [["Q1"]] });
    const parts = unzipSync(base);
    const sheetXml = strFromU8(parts["xl/worksheets/sheet1.xml"])
      .replace('<dimension ref="A1"/>', `<dimension ref="A1:XFD${rows}"/>`)
      .replace("</sheetData>", `${errorRows}</sheetData>`);
    expect(sheetXml).toContain(`XFD${rows}`);
    const sparse = zipSync({ ...parts, "xl/worksheets/sheet1.xml": strToU8(sheetXml) });

    const startedAt = performance.now();
    expect(read(sparse).lines).toEqual([{ key: "R1", cells: [{ key: "A1", text: "Q1" }] }]);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test("takes a sheet whose dimension covers formatted empty rows past the limit", () => {
    // Excel stretches the dimension over cells that only carry formatting, such as a table style.
    const stretched = patched(
      workbook({ Sheet1: [["Q1", "How old are you?"]] }),
      '<dimension ref="A1:B1"/>',
      '<dimension ref="A1:F10000"/>'
    );
    expect(strFromU8(unzipSync(stretched)["xl/worksheets/sheet1.xml"])).toContain("A1:F10000");

    expect(read(stretched).lines).toHaveLength(1);
  });

  test("refuses text past the row limit that the sheet's dimension leaves out", () => {
    // 4,000 rows, a gap, and one more row at 6,000, under a dimension of A1.
    const rows = Array.from({ length: 6_000 }, (_, index) =>
      index < 4_000 || index === 5_999 ? [`Q${index + 1}`] : []
    );
    const understated = patched(
      workbook({ Sheet1: rows }),
      '<dimension ref="A1:A6000"/>',
      '<dimension ref="A1"/>'
    );
    expect(strFromU8(unzipSync(understated)["xl/worksheets/sheet1.xml"])).toContain('<dimension ref="A1"/>');

    expect(refusal(() => read(understated))).toMatchObject({
      code: "document_limit_exceeded",
      identifier: "rows",
    });
  });

  test("allows empty cells past the column limit, and refuses text there wherever the dimension ends", () => {
    const pastTheLimit = columnName(SURVEY_IMPORT_SHEET_MAX_COLUMNS);
    // The dimension stops before the cell: the cell is still read, and still counts.
    const withCell = (value: string) =>
      patched(
        workbook(
          { Sheet1: [["Q1"]] },
          {
            edit: (book) => {
              book.Sheets.Sheet1[`${pastTheLimit}1`] = { t: "s", v: value };
              book.Sheets.Sheet1["!ref"] = `A1:${pastTheLimit}1`;
            },
          }
        ),
        `<dimension ref="A1:${pastTheLimit}1"/>`,
        '<dimension ref="A1"/>'
      );

    expect(strFromU8(unzipSync(withCell("extra"))["xl/worksheets/sheet1.xml"])).toContain(
      '<dimension ref="A1"/>'
    );
    expect(read(withCell("")).lines).toEqual([{ key: "R1", cells: [{ key: "A1", text: "Q1" }] }]);
    // An error cell reads as empty, as SheetJS's own row reader reads it.
    const withError = workbook(
      { Sheet1: [["Q1"]] },
      {
        edit: (book) => {
          book.Sheets.Sheet1[`${pastTheLimit}1`] = { t: "e", v: 0x2a, w: "#N/A" };
          book.Sheets.Sheet1["!ref"] = `A1:${pastTheLimit}1`;
        },
      }
    );
    expect(read(withError).lines).toEqual([{ key: "R1", cells: [{ key: "A1", text: "Q1" }] }]);
    expect(refusal(() => read(withCell("extra")))).toMatchObject({
      code: "document_limit_exceeded",
      identifier: "columns",
      name: "file.R1",
    });
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

  test("never inflates a part SheetJS does not read, whatever the directory declares", () => {
    // A picture whose directory claims it is small: 1 MiB of zeros declared as 1 KiB. SheetJS reads a
    // workbook from its XML parts alone, so the picture is never inflated, nor copied for it.
    const bombed = zipSync({
      ...unzipSync(workbook({ Sheet1: [["Q1"]] })),
      "xl/media/image1.bin": new Uint8Array(1024 * 1024),
    });
    const lying = setDeclaredSizes(bombed, "xl/media/image1.bin", { uncompressedSize: 1024 });

    expect(read(lying).lines).toEqual([{ key: "R1", cells: [{ key: "A1", text: "Q1" }] }]);
  });

  test("counts what an XML part inflates to, whatever the directory declares", () => {
    const bombed = zipSync({
      ...unzipSync(workbook({ Sheet1: [["Q1"]] })),
      "xl/padding.xml": new TextEncoder().encode(`<r>${" ".repeat(1024 * 1024)}</r>`),
    });
    const lying = setDeclaredSizes(bombed, "xl/padding.xml", { uncompressedSize: 1024 });

    expect(() => read(lying)).toThrow(SurveyImportFileTooLargeError);
  });

  test("gives SheetJS the archive the zip guard read, never the upload's own bytes", () => {
    // Every local header defers its sizes to a descriptor (zeros), which SheetJS, sizing each entry from
    // its local header, cannot read; the guard reads each entry from its directory entry.
    let bytes = workbook({ Questions: [["How was your visit?"]] });
    for (const name of openZipArchive(bytes).names) {
      bytes = setFlags(editLocalHeader(bytes, name, { compressedSize: 0, uncompressedSize: 0 }), name, 0x8);
    }
    expect(() => XLSX.read(bytes, { type: "array" })).toThrow();

    expect(read(bytes).lines).toEqual([{ key: "R1", cells: [{ key: "A1", text: "How was your visit?" }] }]);
  });

  describe("holds every XML part to the XML limits before SheetJS reads any", () => {
    /** The workbook with one more part, which SheetJS itself never reads. */
    const withPart = (name: string, text: string): Uint8Array =>
      zipSync({ ...unzipSync(workbook({ Questions: [["How was your visit?"]] })), [name]: strToU8(text) });
    /** A part nesting `depth` levels, its root included. */
    const nested = (depth: number) =>
      `<?xml version="1.0"?><root>${"<n>".repeat(depth - 1)}${"</n>".repeat(depth - 1)}</root>`;

    test("takes a part at the depth limit and refuses one level more, naming the part", () => {
      expect(read(withPart("customXml/item1.xml", nested(SURVEY_IMPORT_XML_MAX_DEPTH))).lines).toHaveLength(
        1
      );

      expect(
        refusal(() => read(withPart("customXml/item1.xml", nested(SURVEY_IMPORT_XML_MAX_DEPTH + 1))))
      ).toEqual({
        name: "file.customXml/item1.xml",
        reason: expect.any(String),
        code: "document_limit_exceeded",
        identifier: "xml_depth",
      });
    });

    test("refuses a part that declares a DTD as unreadable, so no entity is defined", () => {
      const withDtd = patched(
        workbook({ Questions: [["How was your visit?"]] }),
        "<worksheet ",
        '<!DOCTYPE worksheet [<!ENTITY a "aaaaaaaaaa">]><worksheet '
      );

      expect(refusal(() => read(withDtd))).toMatchObject({ code: "file_unreadable" });
    });
  });

  test("refuses a workbook whose first sheet has no text as unreadable", () => {
    expect(refusal(() => read(workbook({ Empty: [[""]], Other: [["Q1"]] })))).toMatchObject({
      code: "file_unreadable",
    });
  });
});
