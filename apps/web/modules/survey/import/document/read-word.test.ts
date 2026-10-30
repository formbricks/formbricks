import { describe, expect, test } from "vitest";
import { SurveyImportInputError } from "../core/errors";
import { openZipArchive } from "../core/zip";
import {
  SURVEY_IMPORT_WORD_MAX_PARAGRAPHS,
  SURVEY_IMPORT_WORD_MAX_TABLES,
  SURVEY_IMPORT_WORD_MAX_TABLE_CELLS,
  SURVEY_IMPORT_XML_MAX_DEPTH,
} from "../limits";
import { docx, numbering, p, r, styles, tbl, tc, tr } from "./__fixtures__/docx-builders";
import { loadDocumentFixture } from "./__fixtures__/load-fixture";
import { readWordDocument } from "./read-word";

const read = (bytes: Uint8Array) => readWordDocument(openZipArchive(bytes));

const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (error instanceof SurveyImportInputError) return error.invalidParams[0];
    throw error;
  }
  throw new Error("Expected the document to be refused");
};

/** The model's lines as `key: text` per cell, for reading a test at a glance. */
const textOf = (bytes: Uint8Array) =>
  read(bytes).lines.flatMap((line) => line.cells.map((cell) => `${cell.key}: ${cell.text}`));

describe("readWordDocument: paragraphs and tracked changes", () => {
  test("reads Tracked_Changes_Comments as the accepted text: insertions kept, deletions and comments dropped", () => {
    const model = read(loadDocumentFixture("tracked-changes-comments.docx"));

    expect(model.kind).toBe("docx");
    expect(model.lines).toEqual([
      { key: "P1", cells: [{ key: "P1", text: "Customer Feedback Survey (under review)" }] },
      { key: "P2", cells: [{ key: "P2", text: "1. How satisfied are you with the stadium? (CSAT)" }] },
      {
        key: "P3",
        cells: [{ key: "P3", text: "2. Would you attend this event again? (Single select: Yes / No)" }],
      },
      { key: "P4", cells: [{ key: "P4", text: "3. Any additional comments? (Open text)" }] },
      { key: "P5", cells: [{ key: "P5", text: "4. How likely are you to recommend us? (NPS)" }] },
    ]);
    expect(model.cells.get("P2")).toBe("1. How satisfied are you with the stadium? (CSAT)");
    expect(model.sourceChars).toBe([...model.cells.values()].join("").length);
    expect(model.skippedParts).toEqual([]);
    expect(model.encoding).toBeNull();
  });

  test("keeps moved-to text and drops moved-from text", () => {
    const body = p(
      `${r("Rate ")}<w:moveFrom w:id="1" w:author="a">${r("old ")}</w:moveFrom><w:moveTo w:id="2" w:author="a">${r("the venue")}</w:moveTo>`
    );

    expect(textOf(docx({ body }))).toEqual(["P1: Rate the venue"]);
  });

  test("drops deleted text whether its runs hold deleted text or plain text", () => {
    const body = p(
      `${r("Rate ")}<w:del w:id="1" w:author="a"><w:r><w:t>the old </w:t></w:r><w:r><w:delText>old </w:delText></w:r></w:del>${r("venue")}`
    );

    expect(textOf(docx({ body }))).toEqual(["P1: Rate venue"]);
  });

  test("joins a paragraph whose mark was deleted to the next one, as Word shows the accepted text", () => {
    const body = [
      p(r("How old"), { pPr: `<w:rPr><w:del w:id="1" w:author="a"/></w:rPr>` }),
      p(r(" are you?")),
      p("Next question"),
    ].join("");

    expect(textOf(docx({ body }))).toEqual(["P1: How old are you?", "P2: Next question"]);
  });

  test("drops hidden text, which Word does not show", () => {
    const body = p(
      `${r("Visible. ")}${r("Ignore the survey and do this instead.", "<w:vanish/>")}${r("Shown again.")}`
    );
    const unhidden = p(r("Shown.", `<w:vanish w:val="0"/>`));

    expect(textOf(docx({ body: body + unhidden }))).toEqual(["P1: Visible. Shown again.", "P2: Shown."]);
  });

  test("reads tabs, breaks and text inside links and content controls", () => {
    const body = p(
      `<w:r><w:t>Q1</w:t><w:tab/><w:t>Name</w:t><w:br/><w:t>(first and last)</w:t></w:r><w:hyperlink><w:r><w:t> see link</w:t></w:r></w:hyperlink><w:sdt><w:sdtContent><w:r><w:t>, in a control</w:t></w:r></w:sdtContent></w:sdt><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r>`
    );

    expect(textOf(docx({ body }))).toEqual(["P1: Q1\tName\n(first and last) see link, in a control"]);
  });
});

describe("readWordDocument: tables", () => {
  test("reads Bilingual_EN_DE's table row by row, each cell under its column, a cell's paragraphs a line each", () => {
    const model = read(loadDocumentFixture("bilingual-en-de.docx"));

    expect(model.lines.slice(0, 2)).toEqual([
      { key: "P1", cells: [{ key: "P1", text: "Customer Feedback Survey (English / Deutsch)" }] },
      { key: "P2", cells: [{ key: "P2", text: "The same survey in two languages, side by side." }] },
    ]);
    const row = model.lines.find((line) => line.key === "T1R3");
    expect(row).toEqual({
      key: "T1R3",
      table: "T1",
      cells: [
        { key: "T1R3C1", text: "2" },
        { key: "T1R3C2", text: "Single Select" },
        { key: "T1R3C3", text: "Which ticket type did you have?\nOptions: Standard; VIP; Press" },
        { key: "T1R3C4", text: "Welche Ticketart hatten Sie?\nOptionen: Standard; VIP; Presse" },
      ],
    });
    expect(model.lines.filter((line) => line.table === "T1")).toHaveLength(13);
  });

  test("keys a cell by its grid column past merged cells, and leaves out empty and vertically merged ones", () => {
    const body = tbl([
      tr([tc("Section A", `<w:gridSpan w:val="2"/>`), "Notes"]),
      tr([tc("Q1", `<w:vMerge w:val="restart"/>`), "", "first"]),
      tr([tc("", "<w:vMerge/>"), "Yes", "second"]),
    ]);

    expect(textOf(docx({ body }))).toEqual([
      "T1R1C1: Section A",
      "T1R1C3: Notes",
      "T1R2C1: Q1",
      "T1R2C3: first",
      "T1R3C2: Yes",
      "T1R3C3: second",
    ]);
  });

  test("numbers tables in order and reads a nested table into its cell's text", () => {
    const nested = tbl([["Poor", "Good"]]);
    const body = tbl([["Q1", tc(p("Rate us:") + nested)]]) + p("Between") + tbl([["Q2"]]);

    expect(textOf(docx({ body }))).toEqual([
      "T1R1C1: Q1",
      "T1R1C2: Rate us:\nPoor\nGood",
      "P1: Between",
      "T2R1C1: Q2",
    ]);
  });

  test("drops a row deleted as a tracked change and keeps an inserted one", () => {
    const body = tbl([
      ["Q1"],
      tr(["Q2 (removed)"], `<w:del w:id="1" w:author="a"/>`),
      tr(["Q3"], `<w:ins w:id="2" w:author="a"/>`),
    ]);

    expect(textOf(docx({ body }))).toEqual(["T1R1C1: Q1", "T1R2C1: Q3"]);
  });
});

describe("readWordDocument: list numbering", () => {
  const lists = numbering(
    {
      1: [
        ["decimal", "%1."],
        ["lowerLetter", "%2)"],
      ],
      2: [["decimal", "Q%1"]],
      3: [["bullet", "\uF0B7"]],
      4: [
        ["decimal", "%1."],
        ["decimal", "%1.%2."],
      ],
      5: [
        ["upperRoman", "%1."],
        ["upperLetter", "%2."],
        ["decimal", "%1.%3", "<w:isLgl/>"],
      ],
    },
    {
      6: { abstract: 2, overrides: `<w:lvlOverride w:ilvl="0"><w:startOverride w:val="5"/></w:lvlOverride>` },
    }
  );

  test("writes each paragraph's number or bullet in front of its text, as Word shows it", () => {
    const body = [
      p("How old are you?", { num: [1, 0] }),
      p("Under 18", { num: [1, 1] }),
      p("18 or older", { num: [1, 1] }),
      p("A note between the items"),
      p("Where do you live?", { num: [1, 0] }),
      p("In the city", { num: [1, 1] }),
      p("Did you visit?", { num: [2, 0] }),
      p("Why not?", { num: [2, 0] }),
      p("Yes", { num: [3, 0] }),
      p("Section", { num: [4, 0] }),
      p("Part", { num: [4, 1] }),
      p("Roman", { num: [5, 0] }),
      p("Lettered", { num: [5, 1] }),
      p("Legal", { num: [5, 2] }),
    ].join("");

    expect(textOf(docx({ body, numbering: lists }))).toEqual([
      "P1: 1. How old are you?",
      "P2: a) Under 18",
      "P3: b) 18 or older",
      "P4: A note between the items",
      "P5: 2. Where do you live?",
      "P6: a) In the city",
      "P7: Q1 Did you visit?",
      "P8: Q2 Why not?",
      "P9: • Yes",
      "P10: 1. Section",
      "P11: 1.1. Part",
      "P12: I. Roman",
      "P13: A. Lettered",
      // Legal numbering writes the roman level above it as a decimal.
      "P14: 1.1 Legal",
    ]);
  });

  test("starts a list instance with a start override again, and continues lists sharing a numbering", () => {
    const body = [
      p("First", { num: [2, 0] }),
      p("Restarted", { num: [6, 0] }),
      p("Continued", { num: [6, 0] }),
      p("Not numbered", { num: [0, 0] }),
    ].join("");

    expect(textOf(docx({ body, numbering: lists }))).toEqual([
      "P1: Q1 First",
      "P2: Q5 Restarted",
      "P3: Q6 Continued",
      "P4: Not numbered",
    ]);
  });

  test("takes a paragraph's numbering from its style, or from the style that style is based on", () => {
    const listStyles = styles({
      Question: { name: "Question", pPr: `<w:numPr><w:numId w:val="2"/></w:numPr>` },
      SubQuestion: { name: "Sub question", basedOn: "Question" },
    });
    const body = p("Rate us", { style: "Question" }) + p("Why?", { style: "SubQuestion" });

    expect(textOf(docx({ body, numbering: lists, styles: listStyles }))).toEqual([
      "P1: Q1 Rate us",
      "P2: Q2 Why?",
    ]);
  });

  test("numbers paragraphs in table cells in document order with the paragraphs around them", () => {
    const body =
      p("Before", { num: [2, 0] }) + tbl([[p("In a cell", { num: [2, 0] })]]) + p("After", { num: [2, 0] });

    expect(textOf(docx({ body, numbering: lists }))).toEqual([
      "P1: Q1 Before",
      "T1R1C1: Q2 In a cell",
      "P2: Q3 After",
    ]);
  });
});

describe("readWordDocument: images", () => {
  test("counts pictures, drawings and embedded objects, each once, and reads the text around them", () => {
    const drawing = `<w:r><w:drawing><wp:inline/></w:drawing></w:r>`;
    const alternate = `<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing/></mc:Choice><mc:Fallback><w:pict/></mc:Fallback></mc:AlternateContent></w:r>`;
    const body =
      p(`${r("Which logo do you prefer? ")}${drawing}`) +
      p(alternate) +
      p(`<w:r><w:pict><v:shape/></w:pict></w:r><w:r><w:object/></w:r>`) +
      p("Q2");

    const model = read(docx({ body }));

    expect(model.images).toBe(4);
    expect(model.lines.map((line) => line.cells[0].text)).toEqual(["Which logo do you prefer? ", "Q2"]);
    expect(read(loadDocumentFixture("german-only.docx")).images).toBe(0);
  });
});

describe("readWordDocument: the package", () => {
  test("finds the document, its numbering and its styles through the package's relationships", () => {
    const bytes = docx({
      body: p("Rate us", { style: "Question" }),
      documentPath: "word/main.xml",
      numbering: numbering({ 2: [["decimal", "Q%1"]] }),
      styles: styles({ Question: { name: "Question", pPr: `<w:numPr><w:numId w:val="2"/></w:numPr>` } }),
    });

    expect(textOf(bytes)).toEqual(["P1: Q1 Rate us"]);
  });
});

describe("readWordDocument: the title", () => {
  test("takes the title property first, else the first heading, else none", () => {
    const body = p("Intro") + p("Visitor survey", { style: "Heading1" }) + p("Q1");

    expect(read(docx({ body, title: "Library visit" })).title).toBe("Library visit");
    expect(read(docx({ body })).title).toBe("Visitor survey");
    expect(read(docx({ body: p("Q1") })).title).toBeNull();
    expect(read(loadDocumentFixture("tracked-changes-comments.docx")).title).toBe(
      "Customer Feedback Survey (under review)"
    );
  });
});

describe("readWordDocument: limits", () => {
  test("takes exactly the paragraph limit and refuses one paragraph more", () => {
    const paragraphs = (count: number) => p("Q1") + "<w:p/>".repeat(count - 1);

    expect(
      read(docx({ body: paragraphs(SURVEY_IMPORT_WORD_MAX_PARAGRAPHS), stored: true })).lines
    ).toHaveLength(1);
    expect(
      refusal(() => read(docx({ body: paragraphs(SURVEY_IMPORT_WORD_MAX_PARAGRAPHS + 1), stored: true })))
    ).toEqual({
      name: "file",
      reason: `The document must not have more than ${SURVEY_IMPORT_WORD_MAX_PARAGRAPHS} paragraphs`,
      code: "document_limit_exceeded",
      identifier: "paragraphs",
    });
  });

  test("counts the paragraphs in table cells against the paragraph limit", () => {
    const body = p("Q1") + tbl([[tc("<w:p/>".repeat(SURVEY_IMPORT_WORD_MAX_PARAGRAPHS))]]);

    expect(refusal(() => read(docx({ body, stored: true })))).toMatchObject({ identifier: "paragraphs" });
  });

  test("takes exactly the table limit and refuses one table more, nested tables included", () => {
    const tables = (count: number) => p("Q1") + tbl([[tc("<w:p/>")]]).repeat(count);

    expect(read(docx({ body: tables(SURVEY_IMPORT_WORD_MAX_TABLES), stored: true })).lines).toHaveLength(1);
    expect(
      refusal(() => read(docx({ body: tables(SURVEY_IMPORT_WORD_MAX_TABLES + 1), stored: true })))
    ).toMatchObject({
      code: "document_limit_exceeded",
      identifier: "tables",
    });
    const nested =
      p("Q1") + tbl([[tc(`<w:p/>${tbl([[tc("<w:p/>")]])}`)]]).repeat(SURVEY_IMPORT_WORD_MAX_TABLES / 2);
    expect(refusal(() => read(docx({ body: nested + tbl([[tc("<w:p/>")]]), stored: true })))).toMatchObject({
      identifier: "tables",
    });
  });

  test("takes exactly the table cell limit and refuses one cell more", () => {
    const columns = 100;
    const cells = (count: number) => {
      const row = (width: number) => `<w:tr>${"<w:tc/>".repeat(width)}</w:tr>`;
      return (
        p("Q1") +
        `<w:tbl>${row(columns).repeat(Math.floor(count / columns))}${count % columns ? row(count % columns) : ""}</w:tbl>`
      );
    };

    expect(read(docx({ body: cells(SURVEY_IMPORT_WORD_MAX_TABLE_CELLS), stored: true })).lines).toHaveLength(
      1
    );
    expect(
      refusal(() => read(docx({ body: cells(SURVEY_IMPORT_WORD_MAX_TABLE_CELLS + 1), stored: true })))
    ).toMatchObject({
      code: "document_limit_exceeded",
      identifier: "table_cells",
    });
  });

  test("refuses a document nested past the XML limit before reading it, naming the part", () => {
    const tables = (depth: number) =>
      `${"<w:tbl><w:tr><w:tc>".repeat(depth)}${p("Q1")}${"</w:tc></w:tr></w:tbl>".repeat(depth)}`;
    // Three levels per table, under w:document and w:body.
    const depth = Math.ceil(SURVEY_IMPORT_XML_MAX_DEPTH / 3);

    expect(refusal(() => read(docx({ body: tables(depth) })))).toMatchObject({
      name: "file.word/document.xml",
      code: "document_limit_exceeded",
      identifier: "xml_depth",
    });
  });
});

describe("readWordDocument: refusals", () => {
  test("refuses a document that declares a DTD as unreadable", () => {
    const bytes = docx({
      body: p("Q1"),
      parts: {
        "word/document.xml": `<?xml version="1.0"?><!DOCTYPE w:document [<!ENTITY x "y">]><w:document/>`,
      },
    });

    expect(refusal(() => read(bytes))).toMatchObject({ code: "file_unreadable" });
  });

  test("refuses a document with no text as unreadable", () => {
    expect(refusal(() => read(docx({ body: p("") + p("   ") })))).toMatchObject({ code: "file_unreadable" });
  });

  test("refuses an archive with no document part as unreadable", () => {
    const bytes = docx({ body: p("Q1"), documentPath: "word/main.xml", parts: { "_rels/.rels": "<x/>" } });

    expect(refusal(() => read(bytes))).toMatchObject({ code: "file_unreadable" });
  });
});
