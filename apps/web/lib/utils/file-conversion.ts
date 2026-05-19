import { AsyncParser } from "@json2csv/node";
import * as xlsx from "xlsx";
import { logger } from "@formbricks/logger";

// Defang spreadsheet formula injection. Cell values starting with
// =, +, -, @, tab, or CR are evaluated as formulas by Excel/Sheets/Numbers.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

const sanitizeFormulaInjection = <T>(value: T): T => {
  if (typeof value === "string" && FORMULA_TRIGGER.test(value)) {
    return `'${value}` as T;
  }
  return value;
};

const sanitizeRows = (rows: Record<string, string | number>[]): Record<string, string | number>[] =>
  rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        sanitizeFormulaInjection(key),
        sanitizeFormulaInjection(value),
      ])
    )
  );

export const convertToCsv = async (fields: string[], jsonData: Record<string, string | number>[]) => {
  let csv: string = "";

  const parser = new AsyncParser({
    fields: fields.map(sanitizeFormulaInjection),
  });

  try {
    csv = await parser.parse(sanitizeRows(jsonData)).promise();
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
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(sanitizeRows(jsonData), {
    header: fields.map(sanitizeFormulaInjection),
  });
  xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
};
