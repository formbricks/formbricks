import { describe, expect, test } from "vitest";
import { MEMBER_ATTRIBUTE_MAX_VALUES_PER_KEY, MEMBER_ATTRIBUTE_MAX_VALUE_LENGTH } from "./limits";
import {
  getMemberAttributeKeyProblem,
  normalizeMemberAttributeValue,
  prepareMemberAttributeValues,
  suggestMemberAttributeKey,
} from "./values";

describe("normalizeMemberAttributeValue", () => {
  test("ignores case and surrounding spaces, like the normalizedValue column", () => {
    expect(normalizeMemberAttributeValue("  Sweden ")).toBe("sweden");
  });
});

describe("prepareMemberAttributeValues", () => {
  test("trims, drops empty values and keeps the first spelling of a duplicate", () => {
    expect(prepareMemberAttributeValues([" Sweden", "", "sweden ", "Norway", "   "])).toEqual({
      ok: true,
      values: ["Sweden", "Norway"],
    });
  });

  test("accepts exactly the per-key cap, counted after deduplication", () => {
    const values = Array.from({ length: MEMBER_ATTRIBUTE_MAX_VALUES_PER_KEY }, (_, i) => `v${i}`);
    expect(prepareMemberAttributeValues([...values, "V0"])).toEqual({ ok: true, values });
  });

  test("refuses one value past the per-key cap", () => {
    const values = Array.from({ length: MEMBER_ATTRIBUTE_MAX_VALUES_PER_KEY + 1 }, (_, i) => `v${i}`);
    expect(prepareMemberAttributeValues(values)).toEqual({
      ok: false,
      problem: { code: "too_many_values", limit: MEMBER_ATTRIBUTE_MAX_VALUES_PER_KEY },
    });
  });

  test("accepts a value at the length cap and refuses one past it", () => {
    const atCap = "a".repeat(MEMBER_ATTRIBUTE_MAX_VALUE_LENGTH);
    expect(prepareMemberAttributeValues([atCap])).toEqual({ ok: true, values: [atCap] });
    const result = prepareMemberAttributeValues([`${atCap}a`]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problem.code).toBe("value_too_long");
  });

  test("refuses a NUL, which Postgres would answer with a 500", () => {
    const result = prepareMemberAttributeValues(["a\u0000b"]);
    expect(!result.ok && result.problem.code).toBe("invalid_character");
  });
});

describe("getMemberAttributeKeyProblem", () => {
  test.each([
    ["country", null],
    ["sales_region_2", null],
    ["", "empty"],
    ["Country", "invalid_format"],
    ["2nd", "invalid_format"],
    ["has-dash", "invalid_format"],
    ["email", "reserved"],
    ["a".repeat(65), "too_long"],
  ])("%s → %s", (key, problem) => {
    expect(getMemberAttributeKeyProblem(key)).toBe(problem);
  });
});

describe("suggestMemberAttributeKey", () => {
  test.each([
    ["Country", "country"],
    ["Sales region", "sales_region"],
    ["  Größe / Taille ", "grosse_taille"],
    ["2026 cohort", "a_2026_cohort"],
    ["!!!", ""],
  ])("%s → %s", (label, key) => {
    expect(suggestMemberAttributeKey(label)).toBe(key);
  });

  test("always suggests a valid key when the label has a letter or digit", () => {
    for (const label of ["Région", "x".repeat(200), "9", "Team (EMEA)"]) {
      expect(getMemberAttributeKeyProblem(suggestMemberAttributeKey(label))).toBeNull();
    }
  });
});
