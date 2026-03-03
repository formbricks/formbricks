import { describe, expect, test } from "vitest";
import { MAX_CSV_VALUES, TSourceField } from "./types";
import { getConnectorOptions, parseCSVColumnsToFields, validateCsvFile } from "./utils";

const mockT = (key: string) => key;

describe("getConnectorOptions", () => {
  test("returns formbricks and csv options", () => {
    const options = getConnectorOptions(mockT as never);
    expect(options).toHaveLength(2);
    expect(options[0].id).toBe("formbricks");
    expect(options[1].id).toBe("csv");
  });

  test("both options are enabled by default", () => {
    const options = getConnectorOptions(mockT as never);
    expect(options.every((o) => !o.disabled)).toBe(true);
  });

  test("uses translation keys for name and description", () => {
    const options = getConnectorOptions(mockT as never);
    expect(options[0].name).toBe("environments.unify.formbricks_surveys");
    expect(options[0].description).toBe("environments.unify.source_connect_formbricks_description");
    expect(options[1].name).toBe("environments.unify.csv_import");
    expect(options[1].description).toBe("environments.unify.source_connect_csv_description");
  });
});

describe("parseCSVColumnsToFields", () => {
  test("parses comma-separated column names into source fields", () => {
    const result = parseCSVColumnsToFields("name,email,score");
    expect(result).toHaveLength(3);
    expect(result).toEqual<TSourceField[]>([
      { id: "name", name: "name", type: "string", sampleValue: "Sample name" },
      { id: "email", name: "email", type: "string", sampleValue: "Sample email" },
      { id: "score", name: "score", type: "string", sampleValue: "Sample score" },
    ]);
  });

  test("trims whitespace from column names", () => {
    const result = parseCSVColumnsToFields(" name , email , score ");
    expect(result[0].id).toBe("name");
    expect(result[1].id).toBe("email");
    expect(result[2].id).toBe("score");
  });

  test("handles single column", () => {
    const result = parseCSVColumnsToFields("feedback");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("feedback");
  });

  test("generates sample values from column names", () => {
    const result = parseCSVColumnsToFields("rating,comment");
    expect(result[0].sampleValue).toBe("Sample rating");
    expect(result[1].sampleValue).toBe("Sample comment");
  });
});

const createMockFile = (name: string, size: number, type: string): File =>
  new File(["x".repeat(size)], name, { type });

describe("validateCsvFile", () => {
  test("accepts a valid .csv file", () => {
    const file = createMockFile("data.csv", 1024, "text/csv");
    const result = validateCsvFile(file, mockT as never);
    expect(result).toEqual({ valid: true });
  });

  test("rejects a file without .csv extension", () => {
    const file = createMockFile("data.xlsx", 1024, "text/csv");
    const result = validateCsvFile(file, mockT as never);
    expect(result).toEqual({ valid: false, error: "environments.unify.csv_files_only" });
  });

  test("rejects a file with wrong MIME type", () => {
    const file = createMockFile("data.csv", 1024, "application/json");
    const result = validateCsvFile(file, mockT as never);
    expect(result).toEqual({ valid: false, error: "environments.unify.csv_files_only" });
  });

  test("accepts a .csv file with empty MIME type", () => {
    const file = createMockFile("data.csv", 1024, "");
    const result = validateCsvFile(file, mockT as never);
    expect(result).toEqual({ valid: true });
  });

  test("accepts a .csv file with alternative csv MIME type", () => {
    const file = createMockFile("report.csv", 512, "application/csv");
    const result = validateCsvFile(file, mockT as never);
    expect(result).toEqual({ valid: true });
  });

  test("rejects a file exceeding the size limit", () => {
    const file = createMockFile("big.csv", MAX_CSV_VALUES.FILE_SIZE + 1, "text/csv");
    const result = validateCsvFile(file, mockT as never);
    expect(result).toEqual({ valid: false, error: "environments.unify.csv_file_too_large" });
  });

  test("accepts a file exactly at the size limit", () => {
    const file = createMockFile("exact.csv", MAX_CSV_VALUES.FILE_SIZE, "text/csv");
    const result = validateCsvFile(file, mockT as never);
    expect(result).toEqual({ valid: true });
  });

  test("checks extension before MIME type", () => {
    const file = createMockFile("data.txt", 100, "text/csv");
    const result = validateCsvFile(file, mockT as never);
    expect(result).toEqual({ valid: false, error: "environments.unify.csv_files_only" });
  });
});
