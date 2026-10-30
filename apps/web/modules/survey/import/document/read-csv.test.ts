import { describe, expect, test } from "vitest";
import { SurveyImportInputError } from "../core/errors";
import {
  SURVEY_IMPORT_SHEET_MAX_CELL_CHARS,
  SURVEY_IMPORT_SHEET_MAX_COLUMNS,
  SURVEY_IMPORT_SHEET_MAX_ROWS,
} from "../limits";
import { loadDocumentFixture, loadDocumentFixtureText } from "./__fixtures__/load-fixture";
import { readCsvDocument } from "./read-csv";

const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (error instanceof SurveyImportInputError) return error.invalidParams[0];
    throw error;
  }
  throw new Error("Expected the CSV to be refused");
};

describe("readCsvDocument", () => {
  test("reads Sample_Survey_2.csv as one line per row, cells keyed like a sheet's", () => {
    const model = readCsvDocument(loadDocumentFixtureText("sample-survey-2.csv"));

    expect(model.kind).toBe("csv");
    expect(model.lines).toHaveLength(18);
    expect(model.lines[0]).toEqual({
      key: "R1",
      cells: [
        { key: "A1", text: "Block #" },
        { key: "B1", text: "Question Type" },
        { key: "C1", text: "Question Text" },
        { key: "D1", text: "Options / Scale" },
        { key: "E1", text: "Required" },
        { key: "F1", text: "Logic" },
      ],
    });
    // A quoted field keeps its comma; the semicolons inside a field are text, not delimiters.
    expect(model.cells.get("B7")).toBe("Rating (star, 1-5)");
    expect(model.cells.get("D3")).toBe("Option A; Option B; Option C");
    expect(model.title).toBeNull();
  });

  test("reads a Windows-1252 list's cells as the file writes them, and says how it was read", () => {
    const model = readCsvDocument(
      new TextDecoder("windows-1252").decode(loadDocumentFixture("budget-cp1252.csv")),
      "windows-1252"
    );

    expect(model.encoding).toBe("windows-1252");
    expect(model.cells.get("B2")).toBe("Wie groß ist Ihr Budget in €?");
    expect(model.cells.get("C2")).toBe("Unter 100 € / Über 100 €");
    expect(model.cells.get("B4")).toBe("Was hat Ihnen gefallen? (Größe, Lage, Öffnungszeiten)");
  });

  test.each([
    ["semicolon", ";"],
    ["tab", "\t"],
    ["pipe", "|"],
    ["comma", ","],
  ])("tells a %s-delimited list apart", (_name, delimiter) => {
    const text = [
      ["Nr", "Frage", "Antworten, getrennt"],
      ["1", "Wie alt sind Sie?", "18-24, 25-34"],
      ["2", "Wohnort", "Stadt, Land"],
    ]
      .map((row) => row.map((cell) => (cell.includes(delimiter) || cell.includes(",") ? `"${cell}"` : cell)))
      .map((row) => row.join(delimiter))
      .join("\n");

    const model = readCsvDocument(text);

    expect(model.cells.get("B2")).toBe("Wie alt sind Sie?");
    expect(model.cells.get("C3")).toBe("Stadt, Land");
    expect(model.lines.every((line) => line.cells.length === 3)).toBe(true);
  });

  test("takes exactly the row limit and refuses one row more", () => {
    const rows = (count: number) => Array.from({ length: count }, (_, index) => `q${index},text`).join("\n");

    expect(readCsvDocument(rows(SURVEY_IMPORT_SHEET_MAX_ROWS)).lines).toHaveLength(
      SURVEY_IMPORT_SHEET_MAX_ROWS
    );
    expect(refusal(() => readCsvDocument(rows(SURVEY_IMPORT_SHEET_MAX_ROWS + 1)))).toMatchObject({
      code: "document_limit_exceeded",
      identifier: "rows",
    });
  });

  test("takes exactly the column limit and refuses one column more", () => {
    const row = (count: number) => Array.from({ length: count }, (_, index) => `c${index}`).join(",");

    expect(readCsvDocument(`${row(SURVEY_IMPORT_SHEET_MAX_COLUMNS)}\na,b`).lines[0].cells).toHaveLength(
      SURVEY_IMPORT_SHEET_MAX_COLUMNS
    );
    expect(refusal(() => readCsvDocument(`a,b\n${row(SURVEY_IMPORT_SHEET_MAX_COLUMNS + 1)}`))).toMatchObject({
      code: "document_limit_exceeded",
      identifier: "columns",
      name: "file.R2",
    });
  });

  test("takes a field of exactly the cell limit and refuses one character more", () => {
    const field = (length: number) => `id,${"x".repeat(length)}`;

    expect(readCsvDocument(field(SURVEY_IMPORT_SHEET_MAX_CELL_CHARS)).cells.get("B1")).toHaveLength(
      SURVEY_IMPORT_SHEET_MAX_CELL_CHARS
    );
    expect(refusal(() => readCsvDocument(field(SURVEY_IMPORT_SHEET_MAX_CELL_CHARS + 1)))).toMatchObject({
      code: "document_limit_exceeded",
      identifier: "cell_size",
      name: "file.B1",
    });
  });

  test("refuses a CSV with an unclosed quote as unreadable", () => {
    expect(refusal(() => readCsvDocument('id,text\n1,"never closed'))).toMatchObject({
      code: "file_unreadable",
    });
  });

  test("refuses a CSV with no text at all as unreadable", () => {
    expect(refusal(() => readCsvDocument(" \n,,\n"))).toMatchObject({ code: "file_unreadable" });
  });
});
