import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import {
  SHOW_CONDITION_BROWSERS,
  SHOW_CONDITION_DEVICE_TYPES,
  SHOW_CONDITION_OPERANDS,
  SHOW_CONDITION_OPERATORS,
  type TShowConditionOperand,
} from "@formbricks/types/show-conditions";
import enUS from "@/locales/en-US.json";
import {
  getShowConditionOperandLabel,
  getShowConditionOperandOptions,
  getShowConditionOperatorLabel,
  getShowConditionOperatorOptions,
  getShowConditionValueOptions,
} from "./options";

// Resolves against the real English strings, so a label pointing at a missing key comes back
// undefined and fails `expectLabel`.
const t = ((key: string) =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      enUS
    )) as unknown as TFunction;
const ALL_OPERANDS = Object.values(SHOW_CONDITION_OPERANDS).flat() as TShowConditionOperand[];
const expectLabel = (label: unknown) => {
  expect(typeof label).toBe("string");
  expect(label).not.toBe("");
};

describe("getShowConditionOperandOptions", () => {
  test("groups the fields as Page, This visit, Device, in the mock's order", () => {
    const groups = getShowConditionOperandOptions(t);

    expect(groups.map((group) => group.value)).toEqual(["page", "visit", "device"]);
    expect(groups.map((group) => group.options.map((option) => option.value))).toEqual([
      ["currentUrl", "queryParam", "pageReferrer", "entryReferrer"],
      ["visitedUrls", "pagesViewed", "uniquePagesViewed", "timeOnSite"],
      ["deviceType", "browser", "screenWidth"],
    ]);
  });

  test("offers every field the schema knows exactly once, in the group of its own type", () => {
    const groups = getShowConditionOperandOptions(t);
    const offered = groups.flatMap((group) => group.options.map((option) => option.value));

    expect([...offered].sort((a, b) => String(a).localeCompare(String(b)))).toEqual(
      [...ALL_OPERANDS].sort((a, b) => a.localeCompare(b))
    );
    for (const group of groups) {
      for (const option of group.options) {
        expect(SHOW_CONDITION_OPERANDS[group.value as keyof typeof SHOW_CONDITION_OPERANDS]).toContain(
          option.value
        );
        expect(option.meta).toEqual({ type: group.value });
        expectLabel(option.label);
      }
      expectLabel(group.label);
    }
  });
});

describe("getShowConditionOperatorOptions", () => {
  // The editor must never offer a pairing the schema would refuse on save.
  test.each(ALL_OPERANDS)("%s offers exactly the operators the schema allows", (operand) => {
    const options = getShowConditionOperatorOptions(operand, t);

    expect(options.map((option) => option.value)).toEqual([...SHOW_CONDITION_OPERATORS[operand]]);
    for (const option of options) expectLabel(option.label);
  });
});

describe("getShowConditionValueOptions", () => {
  test("device offers phone, tablet and desktop", () => {
    const [group] = getShowConditionValueOptions("deviceType", t) ?? [];

    expect(group.options.map((option) => option.value)).toEqual([...SHOW_CONDITION_DEVICE_TYPES]);
    for (const option of group.options) expectLabel(option.label);
  });

  test("browser offers every browser the SDK can detect, other included", () => {
    const [group] = getShowConditionValueOptions("browser", t) ?? [];

    expect(group.options.map((option) => option.value)).toEqual([...SHOW_CONDITION_BROWSERS]);
    for (const option of group.options) expectLabel(option.label);
  });

  test("free-entry fields have no fixed values", () => {
    for (const operand of ALL_OPERANDS.filter((value) => value !== "deviceType" && value !== "browser")) {
      expect(getShowConditionValueOptions(operand, t)).toBeUndefined();
    }
  });
});

describe("labels", () => {
  test("every field and operator has its own label", () => {
    const operandLabels = ALL_OPERANDS.map((operand) => getShowConditionOperandLabel(operand, t));
    const operators = [...new Set(Object.values(SHOW_CONDITION_OPERATORS).flat())];
    const operatorLabels = operators.map((operator) => getShowConditionOperatorLabel(operator, t));

    for (const label of [...operandLabels, ...operatorLabels]) expectLabel(label);
    expect(new Set(operandLabels).size).toBe(ALL_OPERANDS.length);
    expect(new Set(operatorLabels).size).toBe(operators.length);
  });
});
