import { describe, expect, test } from "vitest";
import { MAX_CSV_VALUES, TFieldMapping, TSourceField } from "./types";
import {
  areAllRequiredFieldsMapped,
  getConnectorOptions,
  isConnectorNameValid,
  parseCSVColumnsToFields,
  toggleQuestionId,
  validateCsvFile,
} from "./utils";

const mockT = (key: string) => key;

describe("getConnectorOptions", () => {
  test("returns formbricks, csv, api ingestion, and mcp options", () => {
    const options = getConnectorOptions(mockT as never);
    expect(options).toHaveLength(4);
    expect(options[0].id).toBe("formbricks_survey");
    expect(options[1].id).toBe("csv");
    expect(options[2].id).toBe("api_ingestion");
    expect(options[3].id).toBe("feedback_record_mcp");
  });

  test("both options are enabled by default", () => {
    const options = getConnectorOptions(mockT as never);
    expect(options.every((o) => !o.disabled)).toBe(true);
  });

  test("uses translation keys for name and description", () => {
    const options = getConnectorOptions(mockT as never);
    expect(options[0].name).toBe("workspace.unify.formbricks_surveys");
    expect(options[0].description).toBe("workspace.unify.source_connect_formbricks_description");
    expect(options[1].name).toBe("workspace.unify.csv_import");
    expect(options[1].description).toBe("workspace.unify.source_connect_csv_description");
    expect(options[2].name).toBe("workspace.unify.api_ingestion");
    expect(options[2].description).toBe("workspace.unify.api_ingestion_settings_description");
    expect(options[3].name).toBe("workspace.unify.feedback_record_mcp");
    expect(options[3].description).toBe("workspace.unify.source_connect_feedback_record_mcp_description");
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
    expect(result).toEqual({ valid: false, error: "workspace.unify.csv_files_only" });
  });

  test("rejects a file with wrong MIME type", () => {
    const file = createMockFile("data.csv", 1024, "application/json");
    const result = validateCsvFile(file, mockT as never);
    expect(result).toEqual({ valid: false, error: "workspace.unify.csv_files_only" });
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
    expect(result).toEqual({ valid: false, error: "workspace.unify.csv_file_too_large" });
  });

  test("accepts a file exactly at the size limit", () => {
    const file = createMockFile("exact.csv", MAX_CSV_VALUES.FILE_SIZE, "text/csv");
    const result = validateCsvFile(file, mockT as never);
    expect(result).toEqual({ valid: true });
  });

  test("checks extension before MIME type", () => {
    const file = createMockFile("data.txt", 100, "text/csv");
    const result = validateCsvFile(file, mockT as never);
    expect(result).toEqual({ valid: false, error: "workspace.unify.csv_files_only" });
  });
});

describe("isConnectorNameValid", () => {
  test("returns true for non-empty name", () => {
    expect(isConnectorNameValid("My Connector")).toBe(true);
  });

  test("returns false for empty string", () => {
    expect(isConnectorNameValid("")).toBe(false);
  });

  test("returns false for whitespace-only string", () => {
    expect(isConnectorNameValid("   ")).toBe(false);
    expect(isConnectorNameValid("\t\n  ")).toBe(false);
  });

  test("returns true for name with surrounding whitespace", () => {
    expect(isConnectorNameValid("  name  ")).toBe(true);
  });

  test("returns true for single character", () => {
    expect(isConnectorNameValid("a")).toBe(true);
  });
});

describe("areAllRequiredFieldsMapped", () => {
  const requiredMappings: TFieldMapping[] = [
    { targetFieldId: "collected_at", sourceFieldId: "ts" },
    { targetFieldId: "source_type", staticValue: "csv" },
    { targetFieldId: "field_id", sourceFieldId: "qid" },
    { targetFieldId: "field_type", staticValue: "text" },
  ];

  test("returns true when all required fields have a sourceFieldId or staticValue", () => {
    expect(areAllRequiredFieldsMapped(requiredMappings)).toBe(true);
  });

  test("returns false when a required field is missing entirely", () => {
    const missing = requiredMappings.slice(0, 3);
    expect(areAllRequiredFieldsMapped(missing)).toBe(false);
  });

  test("returns false when a required mapping has neither sourceFieldId nor staticValue", () => {
    const incomplete: TFieldMapping[] = [...requiredMappings.slice(0, 3), { targetFieldId: "field_type" }];
    expect(areAllRequiredFieldsMapped(incomplete)).toBe(false);
  });

  test("ignores mappings for non-required target fields", () => {
    const withOptionals: TFieldMapping[] = [
      ...requiredMappings,
      { targetFieldId: "tenant_id", sourceFieldId: "tenant" },
      { targetFieldId: "unknown_field", sourceFieldId: "anything" },
    ];
    expect(areAllRequiredFieldsMapped(withOptionals)).toBe(true);
  });

  test("returns false for empty mappings array", () => {
    expect(areAllRequiredFieldsMapped([])).toBe(false);
  });

  test("treats empty staticValue and missing sourceFieldId as unmapped", () => {
    const incomplete: TFieldMapping[] = [
      { targetFieldId: "collected_at", sourceFieldId: "ts" },
      { targetFieldId: "source_type", sourceFieldId: "", staticValue: "" },
      { targetFieldId: "field_id", sourceFieldId: "qid" },
      { targetFieldId: "field_type", staticValue: "text" },
    ];
    expect(areAllRequiredFieldsMapped(incomplete)).toBe(false);
  });

  test("counts required field as mapped when only staticValue is set", () => {
    const onlyStatic: TFieldMapping[] = [
      { targetFieldId: "collected_at", staticValue: "2026-01-01" },
      { targetFieldId: "source_type", staticValue: "csv" },
      { targetFieldId: "field_id", staticValue: "id" },
      { targetFieldId: "field_type", staticValue: "text" },
    ];
    expect(areAllRequiredFieldsMapped(onlyStatic)).toBe(true);
  });
});

describe("toggleQuestionId", () => {
  test("adds id when not present", () => {
    expect(toggleQuestionId(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  test("removes id when present", () => {
    expect(toggleQuestionId(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  test("adds to empty selection", () => {
    expect(toggleQuestionId([], "x")).toEqual(["x"]);
  });

  test("returns empty when removing the only id", () => {
    expect(toggleQuestionId(["only"], "only")).toEqual([]);
  });

  test("does not mutate the input array", () => {
    const input = ["a", "b"];
    const result = toggleQuestionId(input, "c");
    expect(input).toEqual(["a", "b"]);
    expect(result).not.toBe(input);
  });

  test("removes only the matching id when duplicates exist", () => {
    expect(toggleQuestionId(["a", "b", "a"], "a")).toEqual(["b"]);
  });
});
