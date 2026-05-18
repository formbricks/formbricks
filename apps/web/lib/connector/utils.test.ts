import { describe, expect, test } from "vitest";
import { type TConnectorFieldMappingCreateInput, ZHubFieldType } from "@formbricks/types/connector";
import {
  formatCsvMissingMappedSourceColumns,
  formatMissingRequiredCsvFieldMappingsMessage,
  getMissingCsvMappedSourceColumns,
  getMissingRequiredCsvFieldMappings,
  getMissingRequiredCsvSourceColumns,
  routeResponseValueTarget,
  sanitizeCsvFieldMappings,
} from "./utils";

describe("sanitizeCsvFieldMappings", () => {
  test("drops user-controlled tenant_id and source_type mappings", () => {
    const mappings: TConnectorFieldMappingCreateInput[] = [
      { sourceFieldId: "tenant", targetFieldId: "tenant_id" },
      { sourceFieldId: "type", targetFieldId: "source_type" },
      { sourceFieldId: "question", targetFieldId: "field_id" },
    ];

    expect(sanitizeCsvFieldMappings(mappings)).toEqual([
      { sourceFieldId: "question", targetFieldId: "field_id" },
      { sourceFieldId: "", targetFieldId: "source_type", staticValue: "csv" },
    ]);
  });

  test("returns undefined for empty input", () => {
    expect(sanitizeCsvFieldMappings(undefined)).toBeUndefined();
    expect(sanitizeCsvFieldMappings([])).toBeUndefined();
  });

  test("returns only the static csv source_type mapping when input is all-protected", () => {
    const mappings: TConnectorFieldMappingCreateInput[] = [
      { sourceFieldId: "tenant", targetFieldId: "tenant_id" },
      { sourceFieldId: "type", targetFieldId: "source_type" },
    ];

    expect(sanitizeCsvFieldMappings(mappings)).toEqual([
      { sourceFieldId: "", targetFieldId: "source_type", staticValue: "csv" },
    ]);
  });
});

describe("getMissingRequiredCsvFieldMappings", () => {
  const requiredMappings: TConnectorFieldMappingCreateInput[] = [
    { sourceFieldId: "response_id", targetFieldId: "submission_id" },
    { sourceFieldId: "question_id", targetFieldId: "field_id" },
    { sourceFieldId: "question", targetFieldId: "field_label" },
    { sourceFieldId: "", targetFieldId: "field_type", staticValue: "text" },
    { sourceFieldId: "answer", targetFieldId: "response_value" },
  ];

  test("returns no missing fields when all required CSV mappings are present", () => {
    expect(getMissingRequiredCsvFieldMappings(requiredMappings)).toEqual([]);
  });

  test("requires submission_id but not source_id", () => {
    const mappings = requiredMappings.filter((mapping) => mapping.targetFieldId !== "submission_id");

    expect(getMissingRequiredCsvFieldMappings(mappings)).toEqual(["submission_id"]);
    expect(getMissingRequiredCsvFieldMappings(requiredMappings)).not.toContain("source_id");
  });

  test("does not require field_label", () => {
    const mappings = requiredMappings.filter((mapping) => mapping.targetFieldId !== "field_label");

    expect(getMissingRequiredCsvFieldMappings(mappings)).not.toContain("field_label");
  });

  test("treats an invalid static field_type as missing", () => {
    const mappings = requiredMappings.map((mapping) =>
      mapping.targetFieldId === "field_type" ? { ...mapping, staticValue: "invalid_type" } : mapping
    );

    expect(getMissingRequiredCsvFieldMappings(mappings)).toContain("field_type");
  });

  test("formats missing required mapping guidance without the legacy terse error", () => {
    expect(formatMissingRequiredCsvFieldMappingsMessage()).toBe(
      "This saved CSV mapping is incomplete. Edit the CSV mapping and choose a CSV column or fixed value for each required field before importing."
    );
  });
});

describe("getMissingCsvMappedSourceColumns", () => {
  test("returns mapped source-to-target pairs for missing CSV headers", () => {
    const missing = getMissingCsvMappedSourceColumns(
      [
        { sourceFieldId: "source_id", targetFieldId: "submission_id" },
        { sourceFieldId: "answer", targetFieldId: "response_value" },
      ],
      ["answer"]
    );

    expect(missing).toEqual([{ sourceFieldId: "source_id", targetFieldId: "submission_id" }]);
    expect(formatCsvMissingMappedSourceColumns(missing)).toBe("source_id -> submission_id");
  });

  test("reports multiple missing source columns separately from mapping details", () => {
    const missing = getMissingCsvMappedSourceColumns(
      [
        { sourceFieldId: "source_id", targetFieldId: "submission_id" },
        { sourceFieldId: "question_id", targetFieldId: "field_id" },
        { sourceFieldId: "answer", targetFieldId: "response_value" },
      ],
      ["answer"]
    );

    expect(formatCsvMissingMappedSourceColumns(missing)).toBe(
      "source_id -> submission_id, question_id -> field_id"
    );
  });

  test("ignores static-value mappings", () => {
    const missing = getMissingCsvMappedSourceColumns(
      [
        { sourceFieldId: "", targetFieldId: "field_type", staticValue: "text" },
        { sourceFieldId: "answer", targetFieldId: "response_value" },
      ],
      ["answer"]
    );

    expect(missing).toEqual([]);
  });
});

describe("getMissingRequiredCsvSourceColumns", () => {
  test("returns missing source_field_id values for required mappings", () => {
    const missing = getMissingRequiredCsvSourceColumns(
      [
        { sourceFieldId: "source_id", targetFieldId: "submission_id" },
        { sourceFieldId: "question_id", targetFieldId: "field_id" },
        { sourceFieldId: "optional_source", targetFieldId: "source_id" },
        { sourceFieldId: "", targetFieldId: "field_type", staticValue: "text" },
        { sourceFieldId: "answer", targetFieldId: "response_value" },
      ],
      ["optional_source", "answer"]
    );

    expect(missing).toEqual(["source_id", "question_id"]);
  });

  test("ignores missing optional mapped source columns", () => {
    const missing = getMissingRequiredCsvSourceColumns(
      [
        { sourceFieldId: "response_id", targetFieldId: "submission_id" },
        { sourceFieldId: "optional_source", targetFieldId: "source_id" },
      ],
      ["response_id"]
    );

    expect(missing).toEqual([]);
  });
});

describe("routeResponseValueTarget", () => {
  test.each([
    ["text", "value_text"],
    ["categorical", "value_text"],
    ["number", "value_number"],
    ["nps", "value_number"],
    ["csat", "value_number"],
    ["ces", "value_number"],
    ["rating", "value_number"],
    ["boolean", "value_boolean"],
    ["date", "value_date"],
  ] as const)("routes %s to %s", (fieldType, expected) => {
    expect(routeResponseValueTarget(fieldType)).toBe(expected);
  });

  test("covers every THubFieldType enum value", () => {
    for (const fieldType of ZHubFieldType.options) {
      expect(() => routeResponseValueTarget(fieldType)).not.toThrow();
    }
  });
});
