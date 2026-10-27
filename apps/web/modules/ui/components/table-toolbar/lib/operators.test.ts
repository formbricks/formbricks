import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { getOperatorLabel, getOperatorName, operatorTakesValue, operatorTakesValues } from "./operators";
import type { TTableFilterOperator } from "./types";

const t = ((key: string) => key) as unknown as TFunction;

describe("operatorTakesValues", () => {
  test("is true only for the list operators", () => {
    expect(operatorTakesValues("includesOneOf")).toBe(true);
    expect(operatorTakesValues("includesAllOf")).toBe(true);
    expect(operatorTakesValues("equals")).toBe(false);
    expect(operatorTakesValues("in")).toBe(false);
  });
});

describe("operatorTakesValue", () => {
  test("is false only for the presence checks", () => {
    expect(operatorTakesValue("isSet")).toBe(false);
    expect(operatorTakesValue("isNotSet")).toBe(false);
    expect(operatorTakesValue("equals")).toBe(true);
    expect(operatorTakesValue("in")).toBe(true);
  });
});

describe("getOperatorLabel", () => {
  test("shows numeric comparisons as symbols", () => {
    expect(getOperatorLabel("greaterThan", t)).toBe(">");
    expect(getOperatorLabel("greaterEqual", t)).toBe("≥");
    expect(getOperatorLabel("lessThan", t)).toBe("<");
    expect(getOperatorLabel("lessEqual", t)).toBe("≤");
  });

  test.each<[TTableFilterOperator, string]>([
    ["equals", "common.table_toolbar.operator_equals"],
    ["notEquals", "common.table_toolbar.operator_not_equals"],
    ["contains", "common.table_toolbar.operator_contains"],
    ["doesNotContain", "common.table_toolbar.operator_does_not_contain"],
    ["startsWith", "common.table_toolbar.operator_starts_with"],
    ["endsWith", "common.table_toolbar.operator_ends_with"],
    ["doesNotStartWith", "common.table_toolbar.operator_does_not_start_with"],
    ["doesNotEndWith", "common.table_toolbar.operator_does_not_end_with"],
    ["includesOneOf", "common.table_toolbar.operator_includes_one_of"],
    ["includesAllOf", "common.table_toolbar.operator_includes_all_of"],
    ["isBefore", "common.table_toolbar.operator_is_before"],
    ["isAfter", "common.table_toolbar.operator_is_after"],
    ["isSet", "common.table_toolbar.operator_is_set"],
    ["isNotSet", "common.table_toolbar.operator_is_not_set"],
    ["in", "common.table_toolbar.operator_is_any_of"],
  ])("shows %s in words", (operator, key) => {
    expect(getOperatorLabel(operator, t)).toBe(key);
  });

  test("falls back to the raw operator for one with no label of its own", () => {
    expect(getOperatorLabel("between", t)).toBe("between");
  });
});

describe("getOperatorName", () => {
  test("spells numeric comparisons out in words for the picker", () => {
    expect(getOperatorName("greaterThan", t)).toBe("common.table_toolbar.operator_greater_than");
    expect(getOperatorName("greaterEqual", t)).toBe("common.table_toolbar.operator_greater_equal");
    expect(getOperatorName("lessThan", t)).toBe("common.table_toolbar.operator_less_than");
    expect(getOperatorName("lessEqual", t)).toBe("common.table_toolbar.operator_less_equal");
  });

  test("uses the chip label for every other operator", () => {
    expect(getOperatorName("contains", t)).toBe("common.table_toolbar.operator_contains");
  });
});
