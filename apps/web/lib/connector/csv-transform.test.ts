import { describe, expect, test, vi } from "vitest";
import { TConnectorFieldMapping } from "@formbricks/types/connector";
import { transformCsvRowToFeedbackRecord, transformCsvRowsToFeedbackRecords } from "./csv-transform";

const NOW = new Date("2026-02-25T10:00:00.000Z");

const makeMapping = (
  sourceFieldId: string,
  targetFieldId: string,
  staticValue?: string
): TConnectorFieldMapping => ({
  id: `mapping-${targetFieldId}`,
  createdAt: NOW,
  connectorId: "conn-1",
  environmentId: "env-1",
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

    const result = transformCsvRowToFeedbackRecord(row, baseMappings);

    expect(result).not.toBeNull();
    expect(result!.source_type).toBe("survey");
    expect(result!.field_id).toBe("q1");
    expect(result!.field_type).toBe("text");
    expect(result!.value_text).toBe("Great product!");
    expect(result!.collected_at).toBe("2026-01-15T10:00:00.000Z");
  });

  test("returns null when required fields are missing", () => {
    const row = { feedback_text: "Great product!" };
    const mappings = [makeMapping("feedback_text", "value_text")];

    const result = transformCsvRowToFeedbackRecord(row, mappings);
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

    const result = transformCsvRowToFeedbackRecord(row, mappings);
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

    const result = transformCsvRowToFeedbackRecord(row, mappings);
    expect(result!.value_number).toBeUndefined();
  });

  test("coerces value_boolean from string", () => {
    const mappings = [...baseMappings, makeMapping("is_promoter", "value_boolean")];

    expect(
      transformCsvRowToFeedbackRecord(
        { feedback_text: "x", question: "q1", timestamp: "2026-01-15", is_promoter: "true" },
        mappings
      )!.value_boolean
    ).toBe(true);

    expect(
      transformCsvRowToFeedbackRecord(
        { feedback_text: "x", question: "q1", timestamp: "2026-01-15", is_promoter: "0" },
        mappings
      )!.value_boolean
    ).toBe(false);

    expect(
      transformCsvRowToFeedbackRecord(
        { feedback_text: "x", question: "q1", timestamp: "2026-01-15", is_promoter: "yes" },
        mappings
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

    const result = transformCsvRowToFeedbackRecord({ question: "q1" }, mappings);
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
    const result = transformCsvRowToFeedbackRecord(row, mappings);
    expect(result!.source_type).toBe("always_survey");
  });

  test("skips empty string values", () => {
    const row = {
      feedback_text: "",
      question: "q1",
      timestamp: "2026-01-15T10:00:00Z",
    };

    const result = transformCsvRowToFeedbackRecord(row, baseMappings);
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

    const result = transformCsvRowToFeedbackRecord(row, mappings);
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

    const result = transformCsvRowToFeedbackRecord(row, mappings);
    expect(result!.metadata).toEqual({ raw: "just a string" });
  });

  test("handles invalid date gracefully", () => {
    const row = {
      feedback_text: "test",
      question: "q1",
      timestamp: "not-a-date",
    };

    const result = transformCsvRowToFeedbackRecord(row, baseMappings);
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

    const { records, skipped } = transformCsvRowsToFeedbackRecords(rows, mappings);

    expect(records).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(records[0].field_id).toBe("q1");
    expect(records[1].field_id).toBe("q2");
  });

  test("returns empty records for empty input", () => {
    const { records, skipped } = transformCsvRowsToFeedbackRecords([], baseMappings);
    expect(records).toHaveLength(0);
    expect(skipped).toBe(0);
  });
});
