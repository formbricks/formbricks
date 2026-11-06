import { describe, expect, test } from "vitest";
import { SurveyImportInputError } from "../core/errors";
import {
  SURVEY_IMPORT_MARKDOWN_MAX_CHARS,
  SURVEY_IMPORT_MARKDOWN_SNIFF_CHARS,
  SURVEY_IMPORT_WORD_MAX_PARAGRAPHS,
  SURVEY_IMPORT_WORD_MAX_TABLE_CELLS,
} from "../limits";
import { prepareDocumentImport } from "./prepare";
import { looksLikeMarkdown, readMarkdownDocument } from "./read-markdown";

const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (error instanceof SurveyImportInputError) return error.invalidParams[0];
    throw error;
  }
  throw new Error("Expected the Markdown file to be refused");
};

const texts = (markdown: string) =>
  readMarkdownDocument(markdown).lines.map((line) => [line.key, line.cells.map((cell) => cell.text)]);

const SAMPLE_TABLE = [
  "# Sample Survey 2",
  "",
  "_One of each question type._",
  "",
  "| Block # | Question Type | Question Text | Options / Scale | Required |",
  "|---|:---|---:|:---:|---|",
  "| 01 | Open Text | What did you think of the event? |  | No |",
  "| 11 | Matrix | Rate each aspect. | Rows: Staff; Value \\| Columns: Poor; Good | No |",
].join("\n");

describe("looksLikeMarkdown", () => {
  test("a pipe table over a delimiter row is Markdown", () => {
    expect(looksLikeMarkdown(SAMPLE_TABLE)).toBe(true);
  });

  test.each([
    ["|---|:--:|", true],
    ["---|---", true],
    ["| --- | :--- | ---: |", true],
    ["|-x-|---|", false],
    ["| a | b |", false],
    ["|", false],
  ])("reads %s under a row of pipes as a delimiter row: %s", (row, isTable) => {
    expect(looksLikeMarkdown(`| A | B |\n${row}`)).toBe(isTable);
  });

  test("judges only the start of the text, so a large upload is not split whole", () => {
    const filler = "Plain line of text\n".repeat(Math.ceil(SURVEY_IMPORT_MARKDOWN_SNIFF_CHARS / 19) + 1);
    const lists = "# Survey\n\n1. Your name?\n2. Your age?\n";

    expect(looksLikeMarkdown(lists + filler)).toBe(true);
    // The same Markdown past the start is not seen.
    expect(looksLikeMarkdown(filler + lists)).toBe(false);
  });

  test("never judges a line the sample cut short", () => {
    // Cut at the limit, this line would read as a delimiter row under the header.
    const line = `|-${" ".repeat(SURVEY_IMPORT_MARKDOWN_SNIFF_CHARS)}x`;

    expect(looksLikeMarkdown(`| A | B |\n${line}\n`)).toBe(false);
  });

  test("decides on a long hostile line in linear time", () => {
    // The old delimiter-row pattern was quadratic in a run of spaces after a dash, its two adjacent
    // whitespace runs splitting it every way: 40k spaces took 0.6 s. These stay inside the sniffed start.
    const spaces = " ".repeat(60_000);
    const hostile = [`|-${spaces}x`, `| --- |${spaces}x`, `|${" -".repeat(30_000)}x`];
    for (const line of hostile) {
      const started = performance.now();
      expect(looksLikeMarkdown(`| A | B |\n${line}`)).toBe(false);
      expect(performance.now() - started).toBeLessThan(200);
    }
  });

  test("headings and list items in text that is no grid are Markdown", () => {
    expect(looksLikeMarkdown("# Survey\n\n1. Your name?\n2. Your age?\n   - Under 18\n   - 18 or over")).toBe(
      true
    );
    expect(looksLikeMarkdown("Question 1: Colour?\n- Red\n- Blue\n\nQuestion 2: Rate us (1, 2, 3)")).toBe(
      true
    );
  });

  test("a CSV question list stays a CSV, numbered first cells included", () => {
    expect(looksLikeMarkdown("#,Question,Type\n1,Your name?,Open Text\n2,Your age?,Number")).toBe(false);
    expect(
      looksLikeMarkdown(
        "1. Your name?,Open Text,\n2. Your age?,Single,Under 18;18+\n3. Colour?,Single,Red;Blue"
      )
    ).toBe(false);
    expect(looksLikeMarkdown("Frage;Typ\n- Name;Text\n- Alter;Zahl\n- Farbe;Auswahl")).toBe(false);
  });

  test("text with a single list line or none is not Markdown", () => {
    expect(looksLikeMarkdown("What is your name?\n- Anything")).toBe(false);
    expect(looksLikeMarkdown("Just one line of text")).toBe(false);
    expect(looksLikeMarkdown("\n\n")).toBe(false);
  });
});

describe("readMarkdownDocument", () => {
  test("reads a numbered list with nested bullets as a Word file's paragraphs, labels first, markup dropped", () => {
    const model = readMarkdownDocument(
      [
        "# Customer Feedback Survey",
        "",
        "1. Which ticket type did you have? _(Single Select)_",
        "   - Standard",
        "   - **VIP**",
        "",
        "2. Rate each aspect (Staff, Facilities, Value). _(Matrix)_",
      ].join("\n"),
      "windows-1252"
    );

    expect(model.kind).toBe("docx");
    expect(model.title).toBe("Customer Feedback Survey");
    expect(model.encoding).toBe("windows-1252");
    expect(model.lines).toEqual([
      { key: "P1", cells: [{ key: "P1", text: "Customer Feedback Survey" }] },
      { key: "P2", cells: [{ key: "P2", text: "1. Which ticket type did you have? (Single Select)" }] },
      { key: "P3", cells: [{ key: "P3", text: "- Standard" }] },
      { key: "P4", cells: [{ key: "P4", text: "- VIP" }] },
      // A comma is text, never a cell boundary.
      { key: "P5", cells: [{ key: "P5", text: "2. Rate each aspect (Staff, Facilities, Value). (Matrix)" }] },
    ]);
  });

  test("a list right under a paragraph is a list, and each line of a paragraph is a line of its own", () => {
    expect(
      texts("Question 2 (Single Select): Which ticket?\n- Standard\n* Press\n\nYes\nNo\n3) Third")
    ).toEqual([
      ["P1", ["Question 2 (Single Select): Which ticket?"]],
      ["P2", ["- Standard"]],
      ["P3", ["* Press"]],
      ["P4", ["Yes"]],
      ["P5", ["No"]],
      ["P6", ["3) Third"]],
    ]);
  });

  test("reads a table row by row, cells trimmed and keyed by column, the delimiter row and empty cells dropped", () => {
    const model = readMarkdownDocument(SAMPLE_TABLE);

    expect(model.lines.map((line) => line.key)).toEqual(["P1", "P2", "T1R1", "T1R2", "T1R3"]);
    expect(model.lines[2]).toEqual({
      key: "T1R1",
      table: "T1",
      cells: [
        { key: "T1R1C1", text: "Block #" },
        { key: "T1R1C2", text: "Question Type" },
        { key: "T1R1C3", text: "Question Text" },
        { key: "T1R1C4", text: "Options / Scale" },
        { key: "T1R1C5", text: "Required" },
      ],
    });
    expect(model.lines[3].cells.map((cell) => cell.key)).toEqual(["T1R2C1", "T1R2C2", "T1R2C3", "T1R2C5"]);
    // An escaped pipe is text inside its cell.
    expect(model.cells.get("T1R3C4")).toBe("Rows: Staff; Value | Columns: Poor; Good");
  });

  test("numbers the tables of a file apart", () => {
    const table = "| a | b |\n|---|---|\n| 1 | 2 |";
    const model = readMarkdownDocument(`${table}\n\nBetween\n\n${table}`);
    expect(model.lines.map((line) => line.key)).toEqual(["T1R1", "T1R2", "P1", "T2R1", "T2R2"]);
  });

  test("drops front matter, HTML, link targets and images, counting the images", () => {
    const model = readMarkdownDocument(
      [
        "---",
        "title: Internal",
        "---",
        "<!-- a note for editors -->",
        "Read our [privacy policy](https://example.com/privacy) first.",
        "",
        "![Logo](logo.png)",
        "",
        "Pick <b>one</b>: `A` or `B`",
        "",
        "***",
      ].join("\n")
    );

    expect(model.lines.map((line) => line.cells[0].text)).toEqual([
      "Read our privacy policy first.",
      "Pick one: A or B",
    ]);
    expect(model.images).toBe(1);
    expect(model.title).toBeNull();
  });

  test("reads a code block's lines as text", () => {
    expect(texts("```\nQ1 Name?\n\nQ2 Age?\n```")).toEqual([
      ["P1", ["Q1 Name?"]],
      ["P2", ["Q2 Age?"]],
    ]);
  });

  test("refuses a file with no text", () => {
    expect(refusal(() => readMarkdownDocument("---\n\n<!-- nothing -->\n"))).toMatchObject({
      code: "file_unreadable",
    });
  });

  test("holds the file's tables to the Word table-cell limit", () => {
    const rows = Array.from(
      { length: SURVEY_IMPORT_WORD_MAX_TABLE_CELLS / 2 },
      (_, index) => `| ${index} | x |`
    );
    expect(refusal(() => readMarkdownDocument(["| A | B |", "| - | - |", ...rows].join("\n")))).toMatchObject(
      {
        code: "document_limit_exceeded",
        identifier: "table_cells",
      }
    );
  });

  test("holds the file to the Word paragraph limit", () => {
    const lines = Array.from(
      { length: SURVEY_IMPORT_WORD_MAX_PARAGRAPHS + 1 },
      (_, index) => `- Item ${index}`
    );
    expect(refusal(() => readMarkdownDocument(lines.join("\n")))).toMatchObject({
      code: "document_limit_exceeded",
      identifier: "paragraphs",
    });
  });
});

describe("readMarkdownDocument: the character cap", () => {
  const heading = "# Survey\n\n";

  test("refuses text past the cap before parsing it, as too large for the AI", () => {
    // Brackets are slow to parse: 15 MB of them took 11 s.
    const text = heading + "[".repeat(SURVEY_IMPORT_MARKDOWN_MAX_CHARS);
    const started = performance.now();

    expect(refusal(() => readMarkdownDocument(text))).toMatchObject({
      code: "document_limit_exceeded",
      identifier: "source_size",
    });
    expect(performance.now() - started).toBeLessThan(100);
  });

  test("reads text at the cap", () => {
    const line = `1. ${"What do you think of it? ".repeat(8)}\n`;
    const text =
      heading + line.repeat(Math.floor((SURVEY_IMPORT_MARKDOWN_MAX_CHARS - heading.length) / line.length));

    expect(text.length).toBeLessThanOrEqual(SURVEY_IMPORT_MARKDOWN_MAX_CHARS);
    expect(readMarkdownDocument(text).lines.length).toBeGreaterThan(2_000);
  });
});

describe("prepareDocumentImport", () => {
  test("reads a text upload that is Markdown with the Markdown reader, and a CSV with the CSV reader", () => {
    const markdown = prepareDocumentImport(
      { type: "csv", text: SAMPLE_TABLE, encoding: "utf-8" },
      "survey.md"
    );
    expect(markdown.model.kind).toBe("docx");
    expect(markdown.model.lines[2].key).toBe("T1R1");

    const csv = prepareDocumentImport(
      { type: "csv", text: "Question,Type\nYour name?,Open Text\nYour age?,Number", encoding: "utf-8" },
      "survey.csv"
    );
    expect(csv.model.kind).toBe("csv");
    expect(csv.model.lines[0].key).toBe("R1");
  });
});
