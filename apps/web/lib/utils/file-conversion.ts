import { AsyncParser } from "@json2csv/node";
import * as xlsx from "xlsx";
import { logger } from "@formbricks/logger";

// Defang spreadsheet formula injection. Cell values starting with
// =, +, -, @, tab, or CR are evaluated as formulas by Excel/Sheets/Numbers.
// Sanitize at the render boundary only — never rewrite row keys, since
// distinct user-controlled labels could collide after prefixing (e.g.
// "=field" and "'=field" both map to "'=field"), dropping cell data.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export const sanitizeFormulaInjection = <T>(value: T): T => {
  if (typeof value === "string" && FORMULA_TRIGGER.test(value)) {
    return `'${value}` as T;
  }
  return value;
};

export type TCsvCell = string | number | null | undefined;

/**
 * One RFC 4180 CSV line, for writers that stream rows instead of building the whole file with
 * `convertToCsv`. Strings are defanged with `sanitizeFormulaInjection` and always quoted (inner quotes
 * doubled), numbers are written bare, and null/undefined become an empty cell. Ends with CRLF.
 */
export const toCsvLine = (cells: readonly TCsvCell[]): string =>
  cells
    .map((cell) => {
      if (cell === null || cell === undefined) return "";
      if (typeof cell === "number") return String(cell);
      return `"${sanitizeFormulaInjection(cell).replaceAll('"', '""')}"`;
    })
    .join(",") + "\r\n";

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
 * Run it after `sanitizeFormulaInjection` so the safety prefix is kept and counted.
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

const toXlsxCell = <T>(value: T): T => truncateForXlsxCell(sanitizeFormulaInjection(value));

export const convertToXlsxBuffer = (
  fields: string[],
  jsonData: Record<string, string | number>[]
): Buffer => {
  // Build as array-of-arrays so original row keys are looked up before
  // sanitization is applied to the rendered header/cell only.
  const headerRow = fields.map(toXlsxCell);
  const dataRows = jsonData.map((row) => fields.map((name) => toXlsxCell(row[name])));

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([headerRow, ...dataRows]);
  xlsx.utils.book_append_sheet(wb, ws, "Response Data");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
};
