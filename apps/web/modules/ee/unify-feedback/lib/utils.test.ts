import { describe, expect, test, vi } from "vitest";
import type { FeedbackRecordData } from "@/modules/hub/types";
import {
  formatSourceType,
  getCreateDefaults,
  getReadOnlyMetadataEntries,
  getValueFieldByType,
  isPresetSourceType,
  mapRecordToValues,
  parseNumberValue,
  resolveFeedbackDisplayText,
  toISOOrUndefined,
  toLocalDateTimeInput,
} from "./utils";

vi.mock("uuid", () => ({ v7: () => "mock-uuid-v7" }));

const makeRecord = (overrides: Partial<FeedbackRecordData> = {}): FeedbackRecordData => ({
  id: "rec-1",
  tenant_id: "tenant-1",
  submission_id: "sub-1",
  collected_at: "2026-03-15T12:00:00.000Z",
  created_at: "2026-03-15T12:00:00.000Z",
  updated_at: "2026-03-15T12:00:00.000Z",
  source_type: "survey",
  field_id: "f1",
  field_type: "text",
  ...overrides,
});

describe("getValueFieldByType", () => {
  test.each([
    ["boolean", "value_boolean"],
    ["date", "value_date"],
    ["nps", "value_number"],
    ["csat", "value_number"],
    ["ces", "value_number"],
    ["rating", "value_number"],
    ["number", "value_number"],
    ["text", "value_text"],
    ["categorical", "value_text"],
  ] as const)("returns %s → %s", (input, expected) => {
    expect(getValueFieldByType(input)).toBe(expected);
  });
});

describe("toLocalDateTimeInput", () => {
  test("formats valid ISO date", () => {
    const result = toLocalDateTimeInput("2026-03-15T14:30:00.000Z");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  test("returns empty string for invalid date", () => {
    expect(toLocalDateTimeInput("not-a-date")).toBe("");
  });
});

describe("toISOOrUndefined", () => {
  test("returns ISO string for valid input", () => {
    expect(toISOOrUndefined("2026-03-15T14:30")).toMatch(/2026-03-15/);
  });

  test("returns undefined for empty string", () => {
    expect(toISOOrUndefined("")).toBeUndefined();
  });

  test("returns undefined for undefined", () => {
    expect(toISOOrUndefined(undefined)).toBeUndefined();
  });

  test("returns undefined for invalid date", () => {
    expect(toISOOrUndefined("not-a-date")).toBeUndefined();
  });
});

describe("getCreateDefaults", () => {
  test("uses first directory as tenant_id", () => {
    const dirs = [{ id: "dir-1", name: "Dir 1" }];
    const result = getCreateDefaults(dirs);
    expect(result.tenant_id).toBe("dir-1");
    expect(result.submission_id).toBe("mock-uuid-v7");
    expect(result.field_type).toBe("text");
    expect(result.metadataEntries).toEqual([]);
  });

  test("handles empty directories", () => {
    const result = getCreateDefaults([]);
    expect(result.tenant_id).toBe("");
  });
});

describe("mapRecordToValues", () => {
  test("maps a full record", () => {
    const record = makeRecord({
      value_text: "hello",
      value_number: 42,
      source_id: "s1",
      source_name: "Survey",
      metadata: { tag: "vip", nested: { a: 1 } },
    });
    const result = mapRecordToValues(record);
    expect(result.id).toBe("rec-1");
    expect(result.value_text).toBe("hello");
    expect(result.value_number).toBe("42");
    expect(result.source_id).toBe("s1");
    expect(result.metadataEntries).toEqual([{ key: "tag", value: "vip" }]);
  });

  test("handles nullish optional fields", () => {
    const record = makeRecord({ value_number: undefined, source_id: undefined });
    const result = mapRecordToValues(record);
    expect(result.value_number).toBe("");
    expect(result.source_id).toBe("");
  });
});

describe("getReadOnlyMetadataEntries", () => {
  test("returns only non-string metadata values", () => {
    const record = makeRecord({ metadata: { tag: "vip", count: 5, nested: { a: 1 } } });
    const result = getReadOnlyMetadataEntries(record);
    expect(result).toEqual([
      { key: "count", value: "5" },
      { key: "nested", value: '{"a":1}' },
    ]);
  });

  test("returns empty array when no metadata", () => {
    expect(getReadOnlyMetadataEntries(makeRecord())).toEqual([]);
  });
});

describe("parseNumberValue", () => {
  test.each([
    ["42", 42],
    ["3.14", 3.14],
    ["-1", -1],
    ["", null],
    ["  ", null],
    ["abc", null],
    ["Infinity", null],
  ])("parseNumberValue(%s) → %s", (input, expected) => {
    expect(parseNumberValue(input)).toBe(expected);
  });
});

describe("isPresetSourceType", () => {
  test("returns true for preset values", () => {
    expect(isPresetSourceType("survey")).toBe(true);
    expect(isPresetSourceType("nps_campaign")).toBe(true);
  });

  test("returns false for custom values", () => {
    expect(isPresetSourceType("custom_type")).toBe(false);
    expect(isPresetSourceType("")).toBe(false);
  });
});

describe("formatSourceType", () => {
  const t = ((key: string) => key) as any;

  test("maps known source types", () => {
    expect(formatSourceType("formbricks", t)).toBe("workspace.unify.formbricks_surveys");
    expect(formatSourceType("formbricks_survey", t)).toBe("workspace.unify.formbricks_surveys");
    expect(formatSourceType("csv", t)).toBe("workspace.unify.csv_import");
  });

  test("returns raw value for unknown types", () => {
    expect(formatSourceType("custom", t)).toBe("custom");
  });
});

describe("resolveFeedbackDisplayText", () => {
  test("prefers the translation when present and different from the original", () => {
    const result = resolveFeedbackDisplayText(
      makeRecord({
        value_text: "Großartig",
        value_text_translated: "Great",
        translation_lang_key: "en",
      })
    );
    expect(result).toEqual({
      text: "Great",
      original: "Großartig",
      isTranslated: true,
      langKey: "en",
    });
  });

  test("falls back to the original when no translation exists", () => {
    const result = resolveFeedbackDisplayText(makeRecord({ value_text: "Hello" }));
    expect(result).toEqual({
      text: "Hello",
      original: "Hello",
      isTranslated: false,
      langKey: null,
    });
  });

  test.each([["   "], [""]])(
    "ignores empty/whitespace-only translations (%j) and shows the original",
    (translated) => {
      const result = resolveFeedbackDisplayText(
        makeRecord({ value_text: "Original", value_text_translated: translated, translation_lang_key: "en" })
      );
      expect(result.text).toBe("Original");
      expect(result.isTranslated).toBe(false);
      expect(result.langKey).toBeNull();
    }
  );

  test("does not flag a translation identical to the original", () => {
    const result = resolveFeedbackDisplayText(
      makeRecord({ value_text: "Same", value_text_translated: "Same", translation_lang_key: "en" })
    );
    expect(result.text).toBe("Same");
    expect(result.isTranslated).toBe(false);
    expect(result.langKey).toBeNull();
  });

  test("drops the language key when there is no usable translation", () => {
    const result = resolveFeedbackDisplayText(
      makeRecord({ value_text: "Hello", translation_lang_key: "en" })
    );
    expect(result.isTranslated).toBe(false);
    expect(result.langKey).toBeNull();
  });

  test("returns null text when the record carries no text value at all", () => {
    const result = resolveFeedbackDisplayText(makeRecord({ value_text: undefined }));
    expect(result.text).toBeNull();
    expect(result.original).toBeNull();
    expect(result.isTranslated).toBe(false);
  });

  test("preserves an empty-string original (does not collapse to null)", () => {
    const result = resolveFeedbackDisplayText(makeRecord({ value_text: "" }));
    expect(result.text).toBe("");
    expect(result.original).toBe("");
  });
});
