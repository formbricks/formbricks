import { describe, expect, test } from "vitest";
import { TConnectorFieldMappingCreateInput } from "@formbricks/types/connector";
import { getMissingRequiredCsvFieldMappings, sanitizeCsvFieldMappings } from "./csv-mapping";

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

  test("treats an invalid static field_type as missing", () => {
    const mappings = requiredMappings.map((mapping) =>
      mapping.targetFieldId === "field_type" ? { ...mapping, staticValue: "invalid_type" } : mapping
    );

    expect(getMissingRequiredCsvFieldMappings(mappings)).toContain("field_type");
  });
});
