import { describe, expect, test } from "vitest";
import { TConnectorFieldMappingCreateInput } from "@formbricks/types/connector";
import { sanitizeCsvFieldMappings } from "./csv-mapping";

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
});
