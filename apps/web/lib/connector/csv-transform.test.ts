import { describe, expect, test, vi } from "vitest";
import { TConnectorFieldMapping } from "@formbricks/types/connector";
import { transformCsvRowToFeedbackRecord, transformCsvRowsToFeedbackRecords } from "./csv-transform";

const NOW = new Date("2026-02-25T10:00:00.000Z");
const TENANT = "tenant-test";

const makeMapping = (
  sourceFieldId: string,
  targetFieldId: string,
  staticValue?: string
): TConnectorFieldMapping => ({
  id: `mapping-${targetFieldId}`,
  createdAt: NOW,
  connectorId: "conn-1",
  workspaceId: "env-1",
  sourceFieldId,
  targetFieldId: targetFieldId as TConnectorFieldMapping["targetFieldId"],
  staticValue: staticValue ?? null,
});

const baseMappings: TConnectorFieldMapping[] = [
  makeMapping("feedback_text", "value_text"),
  makeMapping("question", "field_id"),
  makeMapping("", "source_type", "survey"),
  makeMapping("", "field_type", "text"),
  makeMapping("timestamp", "collected_at"),
];

describe("transformCsvRowToFeedbackRecord", () => {
  test("transforms a basic row with all required fields", () => {
    const row = {
      feedback_text: "Great product!",
      question: "q1",
      timestamp: "2026-01-15T10:00:00Z",
    };

    const result = transformCsvRowToFeedbackRecord(row, baseMappings, TENANT);

    expect(result).not.toBeNull();
    expect(result!.source_type).toBe("survey");
    expect(result!.field_id).toBe("q1");
    expect(result!.field_type).toBe("text");
    expect(result!.value_text).toBe("Great product!");
    expect(result!.collected_at).toBe("2026-01-15T10:00:00.000Z");
    expect(result!.tenant_id).toBe(TENANT);
  });

  test("returns null when required fields are missing", () => {
    const row = { feedback_text: "Great product!" };
    const mappings = [makeMapping("feedback_text", "value_text")];

    const result = transformCsvRowToFeedbackRecord(row, mappings, TENANT);
    expect(result).toBeNull();
  });

  test("returns null when tenant_id is missing", () => {
    const row = {
      feedback_text: "Great product!",
      question: "q1",
      timestamp: "2026-01-15T10:00:00Z",
    };

    const result = transformCsvRowToFeedbackRecord(row, baseMappings);
    expect(result).toBeNull();
  });

  test("auto-generates submission_id as a UUID when unmapped", () => {
    const row = {
      feedback_text: "Great product!",
      question: "q1",
      timestamp: "2026-01-15T10:00:00Z",
    };

    const a = transformCsvRowToFeedbackRecord(row, baseMappings, TENANT);
    const b = transformCsvRowToFeedbackRecord(row, baseMappings, TENANT);

    expect(a!.submission_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(b!.submission_id).not.toBe(a!.submission_id);
  });

  test("uses explicit submission_id mapping when provided", () => {
    const mappings = [...baseMappings, makeMapping("order_id", "submission_id")];
    const row = {
      feedback_text: "x",
      question: "q1",
      timestamp: "2026-01-15",
      order_id: "ORD-42",
    };

    const result = transformCsvRowToFeedbackRecord(row, mappings, TENANT);
    expect(result!.submission_id).toBe("ORD-42");
  });

  test("returns null when submission_id mapped but cell is empty", () => {
    const mappings = [...baseMappings, makeMapping("order_id", "submission_id")];
    const row = {
      feedback_text: "x",
      question: "q1",
      timestamp: "2026-01-15",
      order_id: "",
    };

    const result = transformCsvRowToFeedbackRecord(row, mappings, TENANT);
    expect(result).toBeNull();
  });

  test("returns null when submission_id mapped but column missing from row", () => {
    const mappings = [...baseMappings, makeMapping("order_id", "submission_id")];
    const row = {
      feedback_text: "x",
      question: "q1",
      timestamp: "2026-01-15",
    };

    const result = transformCsvRowToFeedbackRecord(row, mappings, TENANT);
    expect(result).toBeNull();
  });

  test("coerces value_number from string", () => {
    const mappings = [...baseMappings, makeMapping("rating", "value_number")];
    const row = {
      feedback_text: "Good",
      question: "q1",
      timestamp: "2026-01-15T10:00:00Z",
      rating: "4.5",
    };

    const result = transformCsvRowToFeedbackRecord(row, mappings, TENANT);
    expect(result!.value_number).toBe(4.5);
  });

  test("skips value_number when not a valid number", () => {
    const mappings = [...baseMappings, makeMapping("rating", "value_number")];
    const row = {
      feedback_text: "Good",
      question: "q1",
      timestamp: "2026-01-15T10:00:00Z",
      rating: "not-a-number",
    };

    const result = transformCsvRowToFeedbackRecord(row, mappings, TENANT);
    expect(result!.value_number).toBeUndefined();
  });

  test("coerces value_boolean from string", () => {
    const mappings = [...baseMappings, makeMapping("is_promoter", "value_boolean")];

    expect(
      transformCsvRowToFeedbackRecord(
        { feedback_text: "x", question: "q1", timestamp: "2026-01-15", is_promoter: "true" },
        mappings,
        TENANT
      )!.value_boolean
    ).toBe(true);

    expect(
      transformCsvRowToFeedbackRecord(
        { feedback_text: "x", question: "q1", timestamp: "2026-01-15", is_promoter: "0" },
        mappings,
        TENANT
      )!.value_boolean
    ).toBe(false);

    expect(
      transformCsvRowToFeedbackRecord(
        { feedback_text: "x", question: "q1", timestamp: "2026-01-15", is_promoter: "yes" },
        mappings,
        TENANT
      )!.value_boolean
    ).toBe(true);
  });

  test("handles $now static value for collected_at", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const mappings: TConnectorFieldMapping[] = [
      makeMapping("question", "field_id"),
      makeMapping("", "source_type", "csv"),
      makeMapping("", "field_type", "text"),
      makeMapping("", "collected_at", "$now"),
    ];

    const result = transformCsvRowToFeedbackRecord({ question: "q1" }, mappings, TENANT);
    expect(result!.collected_at).toBe(NOW.toISOString());

    vi.useRealTimers();
  });

  test("uses static value over source field", () => {
    const mappings: TConnectorFieldMapping[] = [
      makeMapping("question", "field_id"),
      makeMapping("type_column", "source_type", "always_survey"),
      makeMapping("", "field_type", "text"),
      makeMapping("timestamp", "collected_at"),
    ];

    const row = { question: "q1", type_column: "review", timestamp: "2026-01-15" };
    const result = transformCsvRowToFeedbackRecord(row, mappings, TENANT);
    expect(result!.source_type).toBe("always_survey");
  });

  test("skips empty string values", () => {
    const row = {
      feedback_text: "",
      question: "q1",
      timestamp: "2026-01-15T10:00:00Z",
    };

    const result = transformCsvRowToFeedbackRecord(row, baseMappings, TENANT);
    expect(result!.value_text).toBeUndefined();
  });

  test("parses metadata as JSON", () => {
    const mappings = [...baseMappings, makeMapping("meta", "metadata")];
    const row = {
      feedback_text: "test",
      question: "q1",
      timestamp: "2026-01-15",
      meta: '{"device":"mobile","version":"2.1"}',
    };

    const result = transformCsvRowToFeedbackRecord(row, mappings, TENANT);
    expect(result!.metadata).toEqual({ device: "mobile", version: "2.1" });
  });

  test("wraps non-JSON metadata in { raw: value }", () => {
    const mappings = [...baseMappings, makeMapping("meta", "metadata")];
    const row = {
      feedback_text: "test",
      question: "q1",
      timestamp: "2026-01-15",
      meta: "just a string",
    };

    const result = transformCsvRowToFeedbackRecord(row, mappings, TENANT);
    expect(result!.metadata).toEqual({ raw: "just a string" });
  });

  test("handles invalid date gracefully", () => {
    const row = {
      feedback_text: "test",
      question: "q1",
      timestamp: "not-a-date",
    };

    const result = transformCsvRowToFeedbackRecord(row, baseMappings, TENANT);
    expect(result!.collected_at).toBeUndefined();
  });
});

describe("transformCsvRowsToFeedbackRecords", () => {
  test("transforms multiple rows and counts skipped", () => {
    const rows = [
      { feedback_text: "Good", question: "q1", timestamp: "2026-01-15" },
      { feedback_text: "Bad", question: "q2", timestamp: "2026-01-16" },
      { feedback_text: "No question field" },
    ];

    const mappings: TConnectorFieldMapping[] = [
      makeMapping("feedback_text", "value_text"),
      makeMapping("question", "field_id"),
      makeMapping("", "source_type", "survey"),
      makeMapping("", "field_type", "text"),
      makeMapping("timestamp", "collected_at"),
    ];

    const { records, skipped } = transformCsvRowsToFeedbackRecords(rows, mappings, TENANT);

    expect(records).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(records[0].field_id).toBe("q1");
    expect(records[1].field_id).toBe("q2");
    expect(records[0].submission_id).toBeTruthy();
    expect(records[1].submission_id).toBeTruthy();
    expect(records[0].submission_id).not.toBe(records[1].submission_id);
  });

  test("returns empty records for empty input", () => {
    const { records, skipped } = transformCsvRowsToFeedbackRecords([], baseMappings, TENANT);
    expect(records).toHaveLength(0);
    expect(skipped).toBe(0);
  });
});

describe("response_value routing", () => {
  const responseMappings = (fieldType: string): TConnectorFieldMapping[] => [
    makeMapping("answer", "response_value"),
    makeMapping("question", "field_id"),
    makeMapping("", "source_type", "csv"),
    makeMapping("", "field_type", fieldType),
    makeMapping("timestamp", "collected_at"),
  ];

  test("text routes to value_text", () => {
    const result = transformCsvRowToFeedbackRecord(
      { answer: "great service", question: "q1", timestamp: "2026-01-15" },
      responseMappings("text"),
      TENANT
    );
    expect(result!.value_text).toBe("great service");
    expect(result!.value_number).toBeUndefined();
  });

  test("categorical routes to value_text", () => {
    const result = transformCsvRowToFeedbackRecord(
      { answer: "option_a", question: "q1", timestamp: "2026-01-15" },
      responseMappings("categorical"),
      TENANT
    );
    expect(result!.value_text).toBe("option_a");
  });

  test.each(["number", "nps", "csat", "ces", "rating"])("%s routes to value_number", (fieldType) => {
    const result = transformCsvRowToFeedbackRecord(
      { answer: "9", question: "q1", timestamp: "2026-01-15" },
      responseMappings(fieldType),
      TENANT
    );
    expect(result!.value_number).toBe(9);
    expect(result!.value_text).toBeUndefined();
  });

  test("boolean routes to value_boolean", () => {
    const result = transformCsvRowToFeedbackRecord(
      { answer: "true", question: "q1", timestamp: "2026-01-15" },
      responseMappings("boolean"),
      TENANT
    );
    expect(result!.value_boolean).toBe(true);
  });

  test("date routes to value_date", () => {
    const result = transformCsvRowToFeedbackRecord(
      { answer: "2026-03-01", question: "q1", timestamp: "2026-01-15" },
      responseMappings("date"),
      TENANT
    );
    expect(result!.value_date).toBe("2026-03-01T00:00:00.000Z");
  });

  test("invalid field_type causes the row to be skipped", () => {
    const mappings: TConnectorFieldMapping[] = [
      makeMapping("answer", "response_value"),
      makeMapping("question", "field_id"),
      makeMapping("", "source_type", "csv"),
      makeMapping("", "field_type", "not_a_real_enum"),
      makeMapping("timestamp", "collected_at"),
    ];
    const result = transformCsvRowToFeedbackRecord(
      { answer: "x", question: "q1", timestamp: "2026-01-15" },
      mappings,
      TENANT
    );
    expect(result).toBeNull();
  });

  test("missing field_type causes the row to be skipped", () => {
    const mappings: TConnectorFieldMapping[] = [
      makeMapping("answer", "response_value"),
      makeMapping("question", "field_id"),
      makeMapping("", "source_type", "csv"),
      makeMapping("timestamp", "collected_at"),
    ];
    const result = transformCsvRowToFeedbackRecord(
      { answer: "x", question: "q1", timestamp: "2026-01-15" },
      mappings,
      TENANT
    );
    expect(result).toBeNull();
  });
});

describe("tenant_id defense-in-depth", () => {
  test("ignores a user-supplied tenant_id mapping and uses the connector value", () => {
    const mappings: TConnectorFieldMapping[] = [
      makeMapping("malicious", "tenant_id"),
      makeMapping("feedback_text", "value_text"),
      makeMapping("question", "field_id"),
      makeMapping("", "source_type", "csv"),
      makeMapping("", "field_type", "text"),
      makeMapping("timestamp", "collected_at"),
    ];

    const row = {
      malicious: "stolen-tenant",
      feedback_text: "x",
      question: "q1",
      timestamp: "2026-01-15",
    };
    const result = transformCsvRowToFeedbackRecord(row, mappings, TENANT);

    expect(result!.tenant_id).toBe(TENANT);
    expect(result!.tenant_id).not.toBe("stolen-tenant");
  });

  test("ignores a static tenant_id mapping", () => {
    const mappings: TConnectorFieldMapping[] = [
      makeMapping("", "tenant_id", "stolen-tenant"),
      makeMapping("feedback_text", "value_text"),
      makeMapping("question", "field_id"),
      makeMapping("", "source_type", "csv"),
      makeMapping("", "field_type", "text"),
      makeMapping("timestamp", "collected_at"),
    ];

    const result = transformCsvRowToFeedbackRecord(
      { feedback_text: "x", question: "q1", timestamp: "2026-01-15" },
      mappings,
      TENANT
    );

    expect(result!.tenant_id).toBe(TENANT);
  });
});
