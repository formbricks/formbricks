import { AsyncParser } from "@json2csv/node";
import * as xlsx from "xlsx";
import { logger } from "@formbricks/logger";

export const convertToCsv = async (fields: string[], jsonData: Record<string, string | number>[]) => {
  let csv: string = "";

  const parser = new AsyncParser({
    fields,
  });

  try {
    csv = await parser.parse(jsonData).promise();
  } catch (err) {
    logger.error(err, "Failed to convert to CSV");
    throw new Error("Failed to convert to CSV");
  }
  return csv;
};

export const convertToXlsxBuffer = (fields: string[], jsonData: Record<string, string | number>[]) => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(jsonData, { header: fields });
  xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
};
