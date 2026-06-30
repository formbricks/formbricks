import { describe, expect, test } from "vitest";
import { CSV_HIDDEN_STATIC_MAPPINGS, MAX_CSV_VALUES, TFieldMapping, TSourceField } from "./types";
import {
  areAllRequiredCsvFieldsMapped,
  autoMapCsvSourceFields,
  getFeedbackSourceOptions,
  inferFieldType,
  isFeedbackSourceNameValid,
  parseCSVColumnsToFields,
  titleizeFromFileName,
  toggleQuestionId,
  validateCsvFile,
} from "./utils";

const mockT = (key: string) => key;

describe("getFeedbackSourceOptions", () => {
  test("returns formbricks, csv, api ingestion, and mcp options", () => {
    const options = getFeedbackSourceOptions(mockT as never);
    expect(options).toHaveLength(4);
    expect(options[0].id).toBe("formbricks_survey");
    expect(options[1].id).toBe("csv");
    expect(options[2].id).toBe("api_ingestion");
    expect(options[3].id).toBe("feedback_record_mcp");
  });

  test("both options are enabled by default", () => {
    const options = getFeedbackSourceOptions(mockT as never);
    expect(options.every((o) => !o.disabled)).toBe(true);
  });

  test("uses translation keys for name and description", () => {
    const options = getFeedbackSourceOptions(mockT as never);
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

describe("isFeedbackSourceNameValid", () => {
  test("returns true for non-empty name", () => {
    expect(isFeedbackSourceNameValid("My FeedbackSource")).toBe(true);
  });

  test("returns false for empty string", () => {
    expect(isFeedbackSourceNameValid("")).toBe(false);
  });

  test("returns false for whitespace-only string", () => {
    expect(isFeedbackSourceNameValid("   ")).toBe(false);
    expect(isFeedbackSourceNameValid("\t\n  ")).toBe(false);
  });

  test("returns true for name with surrounding whitespace", () => {
    expect(isFeedbackSourceNameValid("  name  ")).toBe(true);
  });

  test("returns true for single character", () => {
    expect(isFeedbackSourceNameValid("a")).toBe(true);
  });
});

describe("areAllRequiredCsvFieldsMapped", () => {
  const fullMappings: TFieldMapping[] = [
    { targetFieldId: "submission_id", sourceFieldId: "response_id" },
    { targetFieldId: "field_id", sourceFieldId: "qid" },
    { targetFieldId: "field_label", sourceFieldId: "label" },
    { targetFieldId: "field_type", staticValue: "text" },
    { targetFieldId: "response_value", sourceFieldId: "answer" },
  ];

  test("returns valid=true and missing=[] when every required UI field is resolved", () => {
    expect(areAllRequiredCsvFieldsMapped(fullMappings)).toEqual({ valid: true, missing: [] });
  });

  test.each(["submission_id", "field_id", "field_type", "response_value"])(
    "returns valid=false and lists %s when missing",
    (missingId) => {
      const partial = fullMappings.filter((m) => m.targetFieldId !== missingId);
      const result = areAllRequiredCsvFieldsMapped(partial);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain(missingId);
    }
  );

  test("treats whitespace-only staticValue as unmapped", () => {
    const incomplete: TFieldMapping[] = [
      ...fullMappings.filter((m) => m.targetFieldId !== "field_type"),
      { targetFieldId: "field_type", staticValue: "   " },
    ];
    expect(areAllRequiredCsvFieldsMapped(incomplete).missing).toContain("field_type");
  });

  test("treats invalid static field_type as unmapped", () => {
    const invalidFieldType: TFieldMapping[] = [
      ...fullMappings.filter((m) => m.targetFieldId !== "field_type"),
      { targetFieldId: "field_type", staticValue: "not_a_field_type" },
    ];
    expect(areAllRequiredCsvFieldsMapped(invalidFieldType).missing).toContain("field_type");
  });

  test("does not require collected_at (defaults to $now)", () => {
    expect(areAllRequiredCsvFieldsMapped(fullMappings).missing).not.toContain("collected_at");
  });

  test("does not require source_id", () => {
    expect(areAllRequiredCsvFieldsMapped(fullMappings).missing).not.toContain("source_id");
  });

  test("does not require field_label", () => {
    const withoutFieldLabel = fullMappings.filter((m) => m.targetFieldId !== "field_label");

    expect(areAllRequiredCsvFieldsMapped(withoutFieldLabel)).toEqual({ valid: true, missing: [] });
  });
});

describe("CSV_HIDDEN_STATIC_MAPPINGS", () => {
  test("persists source_type=csv with a valid static mapping shape", () => {
    expect(CSV_HIDDEN_STATIC_MAPPINGS).toEqual([
      { sourceFieldId: "", targetFieldId: "source_type", staticValue: "csv" },
    ]);
  });
});

describe("titleizeFromFileName", () => {
  test.each([
    ["feedback.csv", "Feedback"],
    ["q1-2026-survey.csv", "Q1 2026 Survey"],
    ["customer_feedback_data.csv", "Customer Feedback Data"],
    ["Mixed Case File.CSV", "Mixed Case File"],
    ["nps results", "Nps Results"],
    ["", ""],
  ])("titleizes %s to %s", (input, expected) => {
    expect(titleizeFromFileName(input)).toBe(expected);
  });
});

describe("inferFieldType", () => {
  test("detects integer numbers from samples", () => {
    expect(inferFieldType({ samples: ["3", "5", "10"] })).toBe("number");
  });

  test("detects floating-point numbers from samples", () => {
    expect(inferFieldType({ samples: ["3.14", "-2.5"] })).toBe("number");
  });

  test("detects booleans from samples", () => {
    expect(inferFieldType({ samples: ["true", "false", "yes", "no"] })).toBe("boolean");
  });

  test("detects ISO dates from samples", () => {
    expect(inferFieldType({ samples: ["2026-01-01", "2026-02-15T10:00:00Z"] })).toBe("date");
  });

  test("falls back to text for arbitrary strings", () => {
    expect(inferFieldType({ samples: ["hello", "world"] })).toBe("text");
  });

  test("returns text for empty samples", () => {
    expect(inferFieldType({ samples: [] })).toBe("text");
    expect(inferFieldType({ samples: ["", "  "] })).toBe("text");
  });

  test("name hint wins over sample sniff (rating column with garbage samples)", () => {
    expect(inferFieldType({ columnName: "rating", samples: ["asdf", "qwer"] })).toBe("rating");
  });

  test.each([
    ["nps", "nps"],
    ["nps_score", "nps"],
    ["csat", "csat"],
    ["ces", "ces"],
    ["stars", "rating"],
    ["score", "rating"],
    ["comment", "text"],
    ["category", "categorical"],
    ["is_promoter", "boolean"],
    ["has_responded", "boolean"],
    ["submitted_at", "date"],
  ])("name hint %s → %s", (columnName, expected) => {
    expect(inferFieldType({ columnName, samples: [] })).toBe(expected);
  });

  test("name with no hint falls back to sample sniffing", () => {
    expect(inferFieldType({ columnName: "anonymous", samples: ["42"] })).toBe("number");
  });
});

describe("autoMapCsvSourceFields", () => {
  const buildSourceFields = (names: string[]): TSourceField[] =>
    names.map((name) => ({ id: name, name, type: "string", sampleValue: "" }));

  test("maps timestamp column to collected_at with high confidence", () => {
    const result = autoMapCsvSourceFields({
      sourceFields: buildSourceFields(["timestamp", "answer"]),
      sampleRow: { timestamp: "2026-01-01", answer: "yes" },
      fileName: "feedback.csv",
    });
    const mapping = result.mappings.find((m) => m.targetFieldId === "collected_at");
    expect(mapping?.sourceFieldId).toBe("timestamp");
    expect(result.confidence.collected_at).toBe("high");
  });

  test("falls back to $now when no timestamp column is present", () => {
    const result = autoMapCsvSourceFields({
      sourceFields: buildSourceFields(["question", "answer"]),
      sampleRow: { question: "q1", answer: "yes" },
      fileName: "feedback.csv",
    });
    const mapping = result.mappings.find((m) => m.targetFieldId === "collected_at");
    expect(mapping?.staticValue).toBe("$now");
    expect(result.confidence.collected_at).toBe("high");
  });

  test("maps email to user_id with medium confidence", () => {
    const result = autoMapCsvSourceFields({
      sourceFields: buildSourceFields(["email", "answer"]),
      sampleRow: { email: "x@y.com", answer: "yes" },
      fileName: "feedback.csv",
    });
    const mapping = result.mappings.find((m) => m.targetFieldId === "user_id");
    expect(mapping?.sourceFieldId).toBe("email");
    expect(result.confidence.user_id).toBe("medium");
  });

  test.each(["submission_id", "response_id", "record_id", "ticket_id", "order_id"])(
    "maps %s to submission_id with high confidence",
    (columnName) => {
      const result = autoMapCsvSourceFields({
        sourceFields: buildSourceFields([columnName, "question", "answer"]),
        sampleRow: { [columnName]: "stable-1", question: "q1", answer: "yes" },
        fileName: "feedback.csv",
      });
      const mapping = result.mappings.find((m) => m.targetFieldId === "submission_id");
      expect(mapping?.sourceFieldId).toBe(columnName);
      expect(result.confidence.submission_id).toBe("high");
    }
  );

  test("prepopulates source_name from titleized filename", () => {
    const result = autoMapCsvSourceFields({
      sourceFields: buildSourceFields(["question", "answer"]),
      sampleRow: { question: "q1", answer: "yes" },
      fileName: "Q1-2026-survey.csv",
    });
    const mapping = result.mappings.find((m) => m.targetFieldId === "source_name");
    expect(mapping?.staticValue).toBe("Q1 2026 Survey");
    expect(result.confidence.source_name).toBe("high");
  });

  test("keeps source_name filename-derived even when the CSV has a source_name column", () => {
    const result = autoMapCsvSourceFields({
      sourceFields: buildSourceFields(["source_name", "question", "answer"]),
      sampleRow: { source_name: "malicious", question: "q1", answer: "yes" },
      fileName: "trusted-file.csv",
    });
    const mapping = result.mappings.find((m) => m.targetFieldId === "source_name");
    expect(mapping).toEqual({ targetFieldId: "source_name", staticValue: "Trusted File" });
  });

  test("ambiguous column claimed by highest-confidence target", () => {
    const result = autoMapCsvSourceFields({
      sourceFields: buildSourceFields(["question_id", "id"]),
      sampleRow: { question_id: "q1", id: "u1" },
      fileName: "x.csv",
    });
    const fieldIdMapping = result.mappings.find((m) => m.targetFieldId === "field_id");
    expect(fieldIdMapping?.sourceFieldId).toBe("question_id");
    expect(result.confidence.field_id).toBe("high");
  });

  test("maps realistic QA headers without leaving required basics unresolved", () => {
    const result = autoMapCsvSourceFields({
      sourceFields: buildSourceFields([
        "timestamp",
        "response_id",
        "email",
        "question",
        "answer",
        "language",
        "score",
      ]),
      sampleRow: {
        timestamp: "2026-01-01",
        response_id: "resp-1",
        email: "person@example.com",
        question: "How satisfied are you?",
        answer: "Great",
        language: "en",
        score: "9",
      },
      fileName: "google-forms-export.csv",
    });

    const validation = areAllRequiredCsvFieldsMapped(result.mappings);
    expect(validation).toEqual({ valid: true, missing: [] });
    expect(result.mappings.find((m) => m.targetFieldId === "field_id")?.sourceFieldId).toBe("question");
    expect(result.mappings.find((m) => m.targetFieldId === "field_label")?.sourceFieldId).toBe("question");
    expect(result.confidence.field_id).toBe("low");
  });

  test("infers field_type as static via sample sniffing when name has no hint", () => {
    const result = autoMapCsvSourceFields({
      sourceFields: buildSourceFields(["question", "value"]),
      sampleRow: { question: "q1", value: "42" },
      fileName: "x.csv",
    });
    const fieldTypeMapping = result.mappings.find((m) => m.targetFieldId === "field_type");
    expect(fieldTypeMapping?.staticValue).toBe("number");
    expect(result.confidence.field_type).toBe("medium");
  });

  test("infers field_type as 'rating' (high confidence) when response_value column is named 'rating'", () => {
    const result = autoMapCsvSourceFields({
      sourceFields: buildSourceFields(["question", "rating"]),
      sampleRow: { question: "q1", rating: "garbage" },
      fileName: "x.csv",
    });
    const mapping = result.mappings.find((m) => m.targetFieldId === "field_type");
    expect(mapping?.staticValue).toBe("rating");
    expect(result.confidence.field_type).toBe("high");
  });

  test.each(["field_type", "type"])(
    "auto-maps a %s column to field_type (high confidence) over static inference",
    (columnName) => {
      const result = autoMapCsvSourceFields({
        sourceFields: buildSourceFields(["question", "value", columnName]),
        sampleRow: { question: "q1", value: "9", [columnName]: "nps" },
        fileName: "x.csv",
      });
      const mapping = result.mappings.find((m) => m.targetFieldId === "field_type");
      expect(mapping?.sourceFieldId).toBe(columnName);
      expect(mapping?.staticValue).toBeUndefined();
      expect(result.confidence.field_type).toBe("high");
    }
  );

  test.each(["Embedded Data - DeviceType", "Page Type", "Website Type"])(
    "does not auto-map field_type to an unrelated 'type' column (%s)",
    (typeColumn) => {
      const result = autoMapCsvSourceFields({
        sourceFields: buildSourceFields(["response_id", "question", "answer", typeColumn]),
        sampleRow: {
          response_id: "resp-1",
          question: "How was it?",
          answer: "Great",
          [typeColumn]: "Desktop",
        },
        fileName: "feedback.csv",
      });

      // The column merely contains the word "type" and must not be claimed by field_type.
      expect(result.mappings.some((m) => m.sourceFieldId === typeColumn)).toBe(false);

      // field_type should be inferred as a static hub field type from the response value instead.
      const fieldTypeMapping = result.mappings.find((m) => m.targetFieldId === "field_type");
      expect(fieldTypeMapping?.sourceFieldId).toBeUndefined();
      expect(fieldTypeMapping?.staticValue).toBe("text");
    }
  );
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
