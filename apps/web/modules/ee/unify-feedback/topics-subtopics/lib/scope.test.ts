import { describe, expect, test } from "vitest";
import type { TaxonomyFieldOption } from "@/modules/hub/types";
import { fieldKey, sourceKey } from "./scope";

const field: TaxonomyFieldOption = {
  tenant_id: "t",
  source_type: "survey",
  source_id: "src-1",
  field_id: "q1",
  record_count: 10,
  embedding_count: 10,
};

describe("scope keys", () => {
  test("fieldKey joins source_type, source_id and field_id", () => {
    expect(fieldKey(field)).toBe("survey::src-1::q1");
  });

  test("sourceKey joins source_type and source_id", () => {
    expect(sourceKey(field)).toBe("survey::src-1");
  });

  test("preserves the empty 'no source' bucket in both keys", () => {
    expect(fieldKey({ ...field, source_id: "" })).toBe("survey::::q1");
    expect(sourceKey({ ...field, source_id: "" })).toBe("survey::");
  });
});
