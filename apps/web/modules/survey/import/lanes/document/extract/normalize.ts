import { importError, importWarning } from "../../../report";
import type { TImportIssue } from "../../../types";
import { EXTRACT_MAX_CHARS, type TExtractedDocument, type TExtractedDocumentStats } from "./types";

/** Strips a BOM, normalizes line endings, trims trailing spaces and collapses 3+ blank lines. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncateText(text: string, issues: TImportIssue[]): string {
  if (text.length <= EXTRACT_MAX_CHARS) {
    return text;
  }

  issues.push(importWarning({ code: "text_truncated", vars: { max: EXTRACT_MAX_CHARS } }));
  return text.slice(0, EXTRACT_MAX_CHARS);
}

const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+\S/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;

export function computeStats(text: string, pages?: number): TExtractedDocumentStats {
  const lines = text.split("\n");
  let listItems = 0;
  let tables = 0;
  let inTable = false;

  for (const line of lines) {
    if (TABLE_ROW.test(line)) {
      if (!inTable) {
        tables += 1;
        inTable = true;
      }
      continue;
    }
    inTable = false;
    if (LIST_ITEM.test(line)) {
      listItems += 1;
    }
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .filter((block) => block.trim().length > 0 && !TABLE_ROW.test(block.split("\n")[0])).length;

  return {
    chars: text.length,
    paragraphs,
    listItems,
    tables,
    ...(pages === undefined ? {} : { pages }),
  };
}

/** Assembles the common result; `text` is normalized and capped here so every adapter behaves alike. */
export function finishDocument(raw: string, issues: TImportIssue[], pages?: number): TExtractedDocument {
  const text = truncateText(normalizeText(raw), issues);
  return { text, format: "markdown", stats: computeStats(text, pages), issues };
}

/** A fatal result: nothing extractable, the reason in the report. */
export function failedDocument(issue: TImportIssue): TExtractedDocument {
  return {
    text: "",
    format: "markdown",
    stats: { chars: 0, paragraphs: 0, listItems: 0, tables: 0 },
    issues: [issue],
  };
}

function escapeCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

/** Rows → GitHub pipe table; the first row is the header. Ragged rows are padded. */
export function toPipeTable(rows: readonly (readonly string[])[]): string {
  const filled = rows.filter((row) => row.some((cell) => cell.trim().length > 0));
  if (filled.length === 0) {
    return "";
  }

  const width = Math.max(...filled.map((row) => row.length));
  const pad = (row: readonly string[]) =>
    Array.from({ length: width }, (_, index) => escapeCell(row[index] ?? "") || " ");
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;

  const [header, ...body] = filled.map(pad);
  return [line(header), line(header.map(() => "---")), ...body.map(line)].join("\n");
}

const QUESTION_LIST_HEADERS: Record<string, readonly string[]> = {
  Question: ["question", "frage", "question text", "text", "item", "prompt"],
  Type: ["type", "typ", "question type", "kind", "format"],
  Options: ["options", "choices", "answers", "antworten", "optionen", "scale"],
  Required: ["required", "mandatory", "pflicht", "optional"],
};

/**
 * `Columns: Question | Type | Options | Required` when the header row reads like a question list, so
 * the prompt can key on it instead of guessing which column holds the question text.
 */
export function describeQuestionListColumns(header: readonly string[]): string | null {
  const normalized = header.map((cell) => cell.trim().toLowerCase());
  const roles = Object.entries(QUESTION_LIST_HEADERS)
    .filter(([, aliases]) => normalized.some((cell) => aliases.includes(cell)))
    .map(([role]) => role);

  if (!roles.includes("Question") || roles.length < 2) {
    return null;
  }

  return `Columns: ${roles.join(" | ")}`;
}

export class ExtractionTimeoutError extends Error {
  constructor(ms: number) {
    super(`Extraction did not finish within ${ms} ms`);
    this.name = "ExtractionTimeoutError";
  }
}

/**
 * Stops *waiting* for a parser after `ms`; the parser itself cannot be cancelled, so the caller must
 * not hold anything the orphaned promise could touch.
 */
export async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ExtractionTimeoutError(ms)), ms);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Maps a parser failure onto the report: timeouts and everything else are both fatal. */
export function extractionFailure(error: unknown): TImportIssue {
  if (error instanceof ExtractionTimeoutError) {
    return importError({ code: "extraction_timeout" });
  }

  return importError({
    code: "document_unreadable",
    vars: { detail: error instanceof Error ? error.message.slice(0, 200) : "unknown error" },
  });
}
