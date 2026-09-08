import Papa from "papaparse";
import {
  describeQuestionListColumns,
  extractionFailure,
  failedDocument,
  finishDocument,
  toPipeTable,
} from "./normalize";
import type { TExtractedDocument } from "./types";

const MAX_ROWS = 5_000;

/** CSV → a pipe table, delimiter sniffed among `,` `;` and tab, with the question-list hint when it fits. */
export function csvToMarkdown(text: string): string {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    delimitersToGuess: [",", ";", "\t", "|"],
    skipEmptyLines: "greedy",
  });
  const rows = parsed.data.slice(0, MAX_ROWS).map((row) => row.map((cell) => String(cell ?? "")));
  if (rows.length === 0) {
    return "";
  }

  const hint = describeQuestionListColumns(rows[0]);
  return [...(hint ? [hint] : []), toPipeTable(rows)].join("\n\n");
}

export async function extractCsv(bytes: Buffer): Promise<TExtractedDocument> {
  try {
    return finishDocument(csvToMarkdown(bytes.toString("utf8")), []);
  } catch (error) {
    return failedDocument(extractionFailure(error));
  }
}
