import * as XLSX from "xlsx";
import { guardArchive } from "./archive";
import {
  describeQuestionListColumns,
  extractionFailure,
  failedDocument,
  finishDocument,
  toPipeTable,
} from "./normalize";
import type { TExtractedDocument } from "./types";

const MAX_ROWS_PER_SHEET = 2_000;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/** Every sheet becomes a heading plus a pipe table whose first row is the header. */
export function sheetsToMarkdown(workbook: XLSX.WorkBook): string {
  const sections: string[] = [];

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils
      .sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, raw: true })
      .slice(0, MAX_ROWS_PER_SHEET)
      .map((row) => row.map(cellText));
    if (rows.length === 0) continue;

    const hint = describeQuestionListColumns(rows[0]);
    const table = toPipeTable(rows);
    if (table.length === 0) continue;
    sections.push([`## ${name}`, ...(hint ? [hint] : []), table].join("\n\n"));
  }

  return sections.join("\n\n");
}

/** XLSX → one pipe table per sheet. SheetJS parses synchronously, so only the zip guard bounds it. */
export async function extractXlsx(bytes: Buffer): Promise<TExtractedDocument> {
  const rejected = guardArchive(bytes);
  if (rejected) {
    return failedDocument(rejected);
  }

  try {
    const workbook = XLSX.read(bytes, {
      type: "buffer",
      cellDates: true,
      cellFormula: false,
      cellHTML: false,
    });
    return finishDocument(sheetsToMarkdown(workbook), []);
  } catch (error) {
    return failedDocument(extractionFailure(error));
  }
}
