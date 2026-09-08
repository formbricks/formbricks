import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { guardArchive, summarizeArchive } from "./archive";
import { csvToMarkdown } from "./csv";
import { htmlToMarkdown } from "./html-to-markdown";
import { extractDocumentText } from "./index";
import {
  ExtractionTimeoutError,
  computeStats,
  describeQuestionListColumns,
  normalizeText,
  toPipeTable,
  truncateText,
  withTimeout,
} from "./normalize";
import { EXTRACT_MAX_CHARS, PAGE_BREAK } from "./types";

const FIXTURES = join(__dirname, "..", "__fixtures__");
const fixture = (name: string) => readFileSync(join(FIXTURES, name));
const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code);

afterEach(() => {
  vi.useRealTimers();
});

describe("extractDocumentText: DOCX", () => {
  test("a bilingual two-column table survives as a pipe table with all twelve rows", async () => {
    const result = await extractDocumentText("docx", fixture("survey-en-de-table.docx"));

    expect(result.issues).toEqual([]);
    expect(result.text).toContain("# Customer onboarding survey / Kundenumfrage Onboarding");
    expect(result.text).toContain("| # | English | Deutsch |");
    expect(result.text).toContain(
      "| 3 | How likely are you to recommend us? | Wie wahrscheinlich ist es, dass Sie uns empfehlen? |"
    );
    expect(result.text.split("\n").filter((line) => /^\| \d+ \|/.test(line))).toHaveLength(12);
    expect(result.stats.tables).toBe(1);
  });

  test("numbered questions with lettered options become nested lists; page breaks become ---", async () => {
    const result = await extractDocumentText("docx", fixture("survey-numbered-lists.docx"));

    expect(result.issues).toEqual([]);
    expect(result.text).toContain("# Product feedback survey");
    expect(result.text).toContain("## Section A: Usage");
    expect(result.text).toMatch(
      /1\. How often do you use the product\?\n\s+1\. Daily\n\s+2\. Weekly\n\s+3\. Monthly/
    );
    expect(result.text).toContain(PAGE_BREAK.trim());
    expect(result.text).toMatch(/- Keep it under five minutes\n- Send on Tuesdays/);
    expect(result.stats.listItems).toBeGreaterThanOrEqual(10);
  });

  test("an archive with too many entries is rejected before parsing", async () => {
    const result = await extractDocumentText("docx", fixture("zip-bomb.docx"));

    expect(result.text).toBe("");
    expect(result.issues).toEqual([expect.objectContaining({ severity: "error", code: "archive_rejected" })]);
    expect(summarizeArchive(fixture("zip-bomb.docx"))?.entries).toBeGreaterThan(600);
  });

  test("bytes that are not a zip fail as unreadable, not as a crash", async () => {
    const result = await extractDocumentText("docx", Buffer.from("definitely not a zip"));

    expect(codes(result.issues)).toEqual(["document_unreadable"]);
    expect(guardArchive(Buffer.alloc(0))?.code).toBe("document_unreadable");
  });
});

describe("extractDocumentText: XLSX and CSV", () => {
  test("every sheet becomes a heading plus a pipe table, with the question-list hint", async () => {
    const result = await extractDocumentText("xlsx", fixture("questions.xlsx"));

    expect(result.issues).toEqual([]);
    expect(result.text).toContain("## Questions");
    expect(result.text).toContain("Columns: Question | Type | Options | Required");
    expect(result.text).toContain("| Question | Type | Options | Required |");
    expect(result.text).toContain(
      "| Which payment method did you use? | single choice | Card; PayPal; Invoice | yes |"
    );
    expect(result.text).toContain("## Settings");
    expect(result.stats.tables).toBe(2);
  });

  test("a semicolon-delimited CSV with a BOM is sniffed and rendered as a pipe table", async () => {
    const result = await extractDocumentText("csv", fixture("questions.csv"));

    expect(result.issues).toEqual([]);
    expect(result.text.startsWith("Columns: Question | Type | Options | Required")).toBe(true);
    expect(result.text).toContain("| What nearly stopped you from buying? | open text |   | no |");
    expect(result.text.split("\n").filter((line) => line.startsWith("|"))).toHaveLength(7);
  });

  test("csvToMarkdown handles comma and tab delimiters and escapes pipes", () => {
    expect(csvToMarkdown("a,b\n1,x|y\n")).toBe("| a | b |\n| --- | --- |\n| 1 | x\\|y |");
    expect(csvToMarkdown("a\tb\n1\t2\n")).toContain("| 1 | 2 |");
    expect(csvToMarkdown("")).toBe("");
  });
});

describe("extractDocumentText: PDF", () => {
  test("text per page, joined with page breaks", async () => {
    const result = await extractDocumentText("pdf", fixture("survey.pdf"));

    expect(result.issues).toEqual([]);
    expect(result.stats.pages).toBe(2);
    expect(result.text).toContain("Conference feedback survey");
    expect(result.text).toContain("1. How would you rate the keynote? (1-5)");
    expect(result.text).toContain("5. How did you hear about the conference?");
    expect(result.text.split(PAGE_BREAK)).toHaveLength(2);
  });

  test("an image-only PDF is reported as no_text_extracted", async () => {
    const result = await extractDocumentText("pdf", fixture("survey-scanned.pdf"));

    expect(result.text).toBe("");
    expect(result.issues).toEqual([
      expect.objectContaining({ severity: "error", code: "no_text_extracted" }),
    ]);
  });

  test("a password-protected PDF is reported as document_encrypted", async () => {
    const result = await extractDocumentText("pdf", fixture("encrypted.pdf"));

    expect(codes(result.issues)).toEqual(["document_encrypted"]);
  });

  test("garbage bytes are unreadable", async () => {
    const result = await extractDocumentText("pdf", Buffer.from("%PDF-1.4 nope"));

    expect(codes(result.issues)).toEqual(["document_unreadable"]);
  });
});

describe("extractDocumentText: Markdown and text", () => {
  test("passthrough with CRLF, BOM and blank-line normalization", async () => {
    const result = await extractDocumentText("markdown", fixture("survey.md"));

    expect(result.text).toBe(
      "# Employee pulse\n\nA short check-in, three questions.\n\n1. How was your week? (1-5)\n2. What blocked you?\n3. Which of these would help?\n   - Fewer meetings\n   - Clearer priorities\n   - More pairing"
    );
    expect(result.stats).toEqual({ chars: result.text.length, paragraphs: 3, listItems: 6, tables: 0 });
  });

  test("text over the cap is truncated with a warning", async () => {
    const result = await extractDocumentText(
      "text",
      Buffer.from("﻿" + "word ".repeat(EXTRACT_MAX_CHARS / 4))
    );

    expect(result.text).toHaveLength(EXTRACT_MAX_CHARS);
    expect(result.issues).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "text_truncated",
        vars: { max: EXTRACT_MAX_CHARS },
      }),
    ]);
  });

  test("kinds without an extractor fail closed", async () => {
    const result = await extractDocumentText("qsf", Buffer.from("{}"));
    expect(codes(result.issues)).toEqual(["document_unreadable"]);
  });
});

describe("helpers", () => {
  test("normalizeText strips BOM, CRLF, trailing spaces and collapses blank lines", () => {
    expect(normalizeText("﻿a  \r\nb\r\n\r\n\r\n\r\nc\n")).toBe("a\nb\n\nc");
  });

  test("truncateText leaves short text alone", () => {
    const issues: never[] = [];
    expect(truncateText("short", issues)).toBe("short");
    expect(issues).toEqual([]);
  });

  test("toPipeTable pads ragged rows and drops empty ones", () => {
    expect(toPipeTable([["a", "b"], ["1"], ["", ""]])).toBe("| a | b |\n| --- | --- |\n| 1 |   |");
    expect(toPipeTable([])).toBe("");
  });

  test("describeQuestionListColumns needs a question column plus one more", () => {
    expect(describeQuestionListColumns(["Frage", "Typ"])).toBe("Columns: Question | Type");
    expect(describeQuestionListColumns(["Question"])).toBeNull();
    expect(describeQuestionListColumns(["Name", "Email"])).toBeNull();
  });

  test("computeStats counts list items, tables and paragraphs", () => {
    const stats = computeStats("Intro\n\n- a\n- b\n\n| h |\n| --- |\n| 1 |\n\n1) c", 3);
    expect(stats).toEqual({ chars: 41, paragraphs: 3, listItems: 3, tables: 1, pages: 3 });
  });

  test("htmlToMarkdown handles headings, nested lists, breaks and entities", () => {
    const html =
      "<h2>Title &amp; more</h2><p>Line one<br />Line two</p><ol><li>Q1<ul><li>opt a</li><li>opt b</li></ul></li><li>Q2</li></ol><hr /><table><tr><td><p>A</p></td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>";

    expect(htmlToMarkdown(html, toPipeTable)).toBe(
      "## Title & more\n\nLine one\nLine two\n\n1. Q1\n  - opt a\n  - opt b\n2. Q2\n\n---\n\n| A | B |\n| --- | --- |\n| 1 | 2 |"
    );
  });

  test("withTimeout rejects with ExtractionTimeoutError when the parser hangs", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise<never>(() => undefined), 10_000);
    const assertion = expect(pending).rejects.toBeInstanceOf(ExtractionTimeoutError);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  test("withTimeout resolves with the parser result and clears its timer", async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve("done"), 10_000)).resolves.toBe("done");
    expect(vi.getTimerCount()).toBe(0);
  });
});
