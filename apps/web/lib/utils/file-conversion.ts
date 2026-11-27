import { AsyncParser } from "@json2csv/node";
import * as xlsx from "xlsx";
import { logger } from "@formbricks/logger";
import { sanitizeFormulaInjection } from "./csv-cell";

// The cell helpers live in `csv-cell.ts`, which the browser can import too; re-exported for callers here.
export { sanitizeFormulaInjection, toCsvLine, type TCsvCell } from "./csv-cell";

export const convertToCsv = async (fields: string[], jsonData: Record<string, string | number>[]) => {
  let csv: string = "";

  // Field descriptors preserve the original lookup key while overriding the
  // rendered label and cell value with sanitized versions.
  const parser = new AsyncParser({
    fields: fields.map((name) => ({
      label: sanitizeFormulaInjection(name),
      value: (row: Record<string, string | number>) => sanitizeFormulaInjection(row[name]),
    })),
  });

  try {
    csv = await parser.parse(jsonData).promise();
  } catch (err) {
    logger.error(err, "Failed to convert to CSV");
    throw new Error("Failed to convert to CSV");
  }

  return csv;
};

// Excel rejects any cell holding more than 32,767 characters, and SheetJS throws
// on write, which would fail the whole export. CSV has no such limit.
export const XLSX_MAX_CELL_LENGTH = 32767;
export const XLSX_TRUNCATION_MARKER = "...[truncated]";

/**
 * Shortens a string that exceeds Excel's cell limit, ending it with a visible marker.
 * The cut never splits a UTF-16 surrogate pair. Non-strings pass through unchanged.
 */
export const truncateForXlsxCell = <T>(value: T): T => {
  if (typeof value !== "string" || value.length <= XLSX_MAX_CELL_LENGTH) {
    return value;
  }
  let end = XLSX_MAX_CELL_LENGTH - XLSX_TRUNCATION_MARKER.length;
  const lastKept = value.charCodeAt(end - 1);
  if (lastKept >= 0xd800 && lastKept <= 0xdbff) {
    // The kept text would end on a lone high surrogate; drop it with its pair.
    end -= 1;
  }
  return `${value.slice(0, end)}${XLSX_TRUNCATION_MARKER}` as T;
};

// Strings become typed text cells (`t: "s"`, format `@`), which Excel never evaluates, with no
// `sanitizeFormulaInjection` prefix (CODING_STANDARDS.md, "File Uploads and Downloads"). Numbers stay numeric.
const toXlsxCell = (value: string | number | undefined): xlsx.CellObject | number | undefined =>
  typeof value === "string" ? { t: "s", v: truncateForXlsxCell(value), z: "@" } : value;

export const convertToXlsxBuffer = (
  fields: string[],
  jsonData: Record<string, string | number>[]
): Buffer => {
  // Build as array-of-arrays so cells are looked up by the original row keys.
  const headerRow = fields.map(toXlsxCell);
  const dataRows = jsonData.map((row) => fields.map((name) => toXlsxCell(row[name])));

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([headerRow, ...dataRows]);
  xlsx.utils.book_append_sheet(wb, ws, "Response Data");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
};
