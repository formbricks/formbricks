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

export const convertToXlsxBuffer = (
  fields: string[],
  jsonData: Record<string, string | number>[]
): Buffer => {
  // Build as array-of-arrays so original row keys are looked up before
  // sanitization is applied to the rendered header/cell only.
  const headerRow = fields.map(sanitizeFormulaInjection);
  const dataRows = jsonData.map((row) => fields.map((name) => sanitizeFormulaInjection(row[name])));

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([headerRow, ...dataRows]);
  xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
};
