import { describe, expect, test } from "vitest";
import {
  CSV_AT_LEAST_ONE_ROW_ERROR_CODE,
  CSV_EMPTY_COLUMN_HEADERS_ERROR_CODE,
  CSV_FILES_ONLY_ERROR_CODE,
  CSV_FILE_TOO_LARGE_ERROR_CODE,
  CSV_INCONSISTENT_COLUMNS_ERROR_CODE,
  CSV_MAX_RECORDS_ERROR_CODE,
  MAX_CSV_VALUES,
} from "@/modules/ee/unify-feedback/sources/types";
import { CsvImportValidationError, parseCsvImportFile } from "./csv-file-import";

const createFile = (name: string, content: string, type = "text/csv") => new File([content], name, { type });

const expectCsvValidationError = async (file: File, code: string) => {
  await expect(parseCsvImportFile(file)).rejects.toMatchObject({
    name: "CsvImportValidationError",
    code,
  } satisfies Partial<CsvImportValidationError>);
};

const createLargeCsvContent = () => {
  const rowCount = 900;
  const payload = "x".repeat(16_500);
  const rows = Array.from(
    { length: rowCount },
    (_, index) => `sub-${index.toString()},question,text,"${payload}"`
  );

  return ["submission_id,field_id,field_type,response_value", ...rows].join("\n");
};

describe("parseCsvImportFile", () => {
  test("accepts a CSV larger than 14MB and under the 15MB cap", async () => {
    const content = createLargeCsvContent();
    const file = createFile("large.csv", content);

    expect(file.size).toBeGreaterThanOrEqual(14 * 1024 * 1024);
    expect(file.size).toBeLessThanOrEqual(MAX_CSV_VALUES.FILE_SIZE);

    const rows = await parseCsvImportFile(file);

    expect(rows).toHaveLength(900);
    expect(rows[0].submission_id).toBe("sub-0");
  });

  test("rejects a non-CSV file", async () => {
    await expectCsvValidationError(
      createFile("large.json", "{}", "application/json"),
      CSV_FILES_ONLY_ERROR_CODE
    );
  });

  test("rejects a CSV larger than 15MB before parsing", async () => {
    const file = createFile("large.csv", "x".repeat(MAX_CSV_VALUES.FILE_SIZE + 1));

    await expectCsvValidationError(file, CSV_FILE_TOO_LARGE_ERROR_CODE);
  });

  test("rejects an empty CSV", async () => {
    await expectCsvValidationError(
      createFile("empty.csv", "submission_id,field_id\n"),
      CSV_AT_LEAST_ONE_ROW_ERROR_CODE
    );
  });

  test("rejects a CSV over the record cap", async () => {
    const rows = Array.from(
      { length: MAX_CSV_VALUES.RECORDS + 1 },
      (_, index) => `sub-${index.toString()},q1`
    );
    const file = createFile("too-many.csv", ["submission_id,field_id", ...rows].join("\n"));

    await expectCsvValidationError(file, CSV_MAX_RECORDS_ERROR_CODE);
  });

  test("rejects empty headers", async () => {
    const file = createFile("empty-header.csv", "submission_id,\nsub-1,q1");

    await expectCsvValidationError(file, CSV_EMPTY_COLUMN_HEADERS_ERROR_CODE);
  });

  test("rejects inconsistent row columns", async () => {
    const file = createFile("inconsistent.csv", "submission_id,field_id\nsub-1,q1\nsub-2");

    await expect(parseCsvImportFile(file)).rejects.toMatchObject({
      code: CSV_INCONSISTENT_COLUMNS_ERROR_CODE,
      row: 2,
    });
  });
});
