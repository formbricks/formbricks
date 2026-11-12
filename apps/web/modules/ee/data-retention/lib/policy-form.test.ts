import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import {
  CUSTOM,
  getPolicyFormPeriodDays,
  getPolicyFormSchema,
  getPolicyFormWarnDays,
  orderConditions,
  toPoliciesPatch,
  toPolicyFormValues,
  toPolicyPatch,
} from "./policy-form";
import { RETENTION_POLICY_DEFAULTS } from "./policy-rules";

const t = ((key: string) => key) as unknown as TFunction;

describe("toPolicyFormValues", () => {
  test("picks the preset that matches the saved period and notice", () => {
    expect(toPolicyFormValues(RETENTION_POLICY_DEFAULTS.surveys)).toMatchObject({
      periodPreset: "1095",
      warnPreset: "60",
      conditions: ["noResponse", "noChange"],
    });
  });

  test("falls back to the custom inputs, in the largest unit that fits", () => {
    expect(
      toPolicyFormValues({
        ...RETENTION_POLICY_DEFAULTS.responses,
        periodDays: 180,
        warnDays: 45,
      })
    ).toMatchObject({
      periodPreset: CUSTOM,
      customPeriodAmount: 6,
      customPeriodUnit: "months",
      warnPreset: CUSTOM,
      customWarnDays: 45,
    });
  });
});

describe("getPolicyFormPeriodDays / getPolicyFormWarnDays", () => {
  test("read a preset or convert the custom input", () => {
    expect(
      getPolicyFormPeriodDays({ periodPreset: "365", customPeriodAmount: 9, customPeriodUnit: "days" })
    ).toBe(365);
    expect(
      getPolicyFormPeriodDays({ periodPreset: CUSTOM, customPeriodAmount: 2, customPeriodUnit: "years" })
    ).toBe(730);
    expect(getPolicyFormWarnDays({ warnPreset: CUSTOM, customWarnDays: 45 })).toBe(45);
  });

  test("give null for an empty or non-positive custom value", () => {
    for (const amount of [null, 0, -3, Number.NaN]) {
      expect(
        getPolicyFormPeriodDays({
          periodPreset: CUSTOM,
          customPeriodAmount: amount,
          customPeriodUnit: "days",
        })
      ).toBeNull();
    }
    expect(getPolicyFormWarnDays({ warnPreset: CUSTOM, customWarnDays: null })).toBeNull();
  });

  // ENG-7038: a decimal is accepted and stored as the nearest whole day.
  test("round a decimal custom value to the nearest day", () => {
    expect(
      getPolicyFormPeriodDays({ periodPreset: CUSTOM, customPeriodAmount: 2.5, customPeriodUnit: "years" })
    ).toBe(913);
    expect(
      getPolicyFormPeriodDays({ periodPreset: CUSTOM, customPeriodAmount: 1.5, customPeriodUnit: "months" })
    ).toBe(45);
    expect(getPolicyFormWarnDays({ warnPreset: CUSTOM, customWarnDays: 20.5 })).toBe(21);
  });

  test("keep the saved days while the custom period still reads as the saved one", () => {
    // 403 days shows as "1.1 years", which converts back to 402: an untouched save must not shorten it.
    const saved = { periodDays: 403 };
    const shown = toPolicyFormValues({ ...RETENTION_POLICY_DEFAULTS.responses, ...saved });
    expect(shown).toMatchObject({ periodPreset: CUSTOM, customPeriodAmount: 1.1, customPeriodUnit: "years" });
    expect(getPolicyFormPeriodDays(shown, saved)).toBe(403);
    expect(getPolicyFormPeriodDays({ ...shown, customPeriodAmount: 1.2 }, saved)).toBe(438);
    expect(getPolicyFormPeriodDays({ ...shown, customPeriodUnit: "months" }, saved)).toBe(33);
  });
});

describe("getPolicyFormSchema", () => {
  const valid = toPolicyFormValues(RETENTION_POLICY_DEFAULTS.surveys);

  test("accepts the defaults", () => {
    expect(getPolicyFormSchema(t, "surveys").safeParse(valid).success).toBe(true);
  });

  test.each([
    [
      "a period under 30 days",
      { periodPreset: CUSTOM, customPeriodAmount: 29, customPeriodUnit: "days", warnPreset: "14" },
      "customPeriodAmount",
    ],
    [
      "a period over 10 years",
      { periodPreset: CUSTOM, customPeriodAmount: 11, customPeriodUnit: "years" },
      "customPeriodAmount",
    ],
    ["an empty custom period", { periodPreset: CUSTOM, customPeriodAmount: null }, "customPeriodAmount"],
    ["a notice under two weeks", { warnPreset: CUSTOM, customWarnDays: 13 }, "customWarnDays"],
    ["no survey condition", { conditions: [] }, "conditions"],
    ["a notice as long as the period", { periodPreset: "30", warnPreset: "60" }, "warnPreset"],
  ] as const)("refuses %s", (_case, override, path) => {
    const result = getPolicyFormSchema(t, "surveys").safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([path]);
  });

  // ENG-7038: 2.5 years is inside the range, so it is accepted, not refused as out of range.
  test.each([
    ["2.5 years", { periodPreset: CUSTOM, customPeriodAmount: 2.5, customPeriodUnit: "years" }],
    ["2.5 months", { periodPreset: CUSTOM, customPeriodAmount: 2.5, customPeriodUnit: "months" }],
    ["a notice of 20.5 days", { warnPreset: CUSTOM, customWarnDays: 20.5 }],
  ] as const)("accepts %s", (_case, override) => {
    expect(getPolicyFormSchema(t, "surveys").safeParse({ ...valid, ...override }).success).toBe(true);
  });

  test("checks the range on the rounded days", () => {
    const period = (customPeriodAmount: number, customPeriodUnit: "years" | "days") =>
      getPolicyFormSchema(t, "surveys").safeParse({
        ...valid,
        periodPreset: CUSTOM,
        customPeriodAmount,
        customPeriodUnit,
        warnPreset: "14",
      }).success;
    // 10.001 years is 3650.4 days: over the limit before rounding, at it after.
    expect(period(10.001, "years")).toBe(true);
    expect(period(10.01, "years")).toBe(false);
    // 29.5 days rounds up to the minimum; 29.4 and 0.4 (0 days) do not reach it.
    expect(period(29.5, "days")).toBe(true);
    expect(period(29.4, "days")).toBe(false);
    expect(period(0.4, "days")).toBe(false);
  });

  test("doesn't ask other policies for conditions", () => {
    const members = toPolicyFormValues(RETENTION_POLICY_DEFAULTS.members);
    expect(getPolicyFormSchema(t, "members").safeParse(members).success).toBe(true);
  });
});

describe("toPolicyPatch", () => {
  test("sends the fields the dialog edits, under each policy's period field", () => {
    const values = { ...toPolicyFormValues(RETENTION_POLICY_DEFAULTS.surveys), enabled: true };
    expect(toPolicyPatch("surveys", { ...values, conditions: ["createdBefore", "noResponse"] })).toEqual({
      enabled: true,
      warnDays: 60,
      periodDays: 1095,
      conditions: ["noResponse", "createdBefore"],
    });
    expect(toPolicyPatch("responses", toPolicyFormValues(RETENTION_POLICY_DEFAULTS.responses))).toEqual({
      enabled: false,
      warnDays: 60,
      periodDays: 1095,
    });
  });

  test("refuses an invalid form rather than sending it", () => {
    const values = toPolicyFormValues(RETENTION_POLICY_DEFAULTS.members);
    expect(() =>
      toPolicyPatch("members", { ...values, periodPreset: CUSTOM, customPeriodAmount: null })
    ).toThrow();
  });
});

describe("orderConditions", () => {
  test("puts conditions in their canonical order", () => {
    expect(orderConditions(["createdBefore", "noChange"])).toEqual(["noChange", "createdBefore"]);
  });
});

describe("toPoliciesPatch", () => {
  const saved = { ...RETENTION_POLICY_DEFAULTS.surveys, enabled: true };

  test("sends only what changed, so a concurrent pause isn't undone by an unrelated edit", () => {
    const values = { ...toPolicyFormValues(saved), warnPreset: "30" };

    expect(toPoliciesPatch("surveys", values, saved)).toEqual({ surveys: { warnDays: 30 } });
  });

  test("leaves a period shown rounded alone, and sends it once it is edited", () => {
    // 403 days opens as "1.1 years"; converted back that is 402, a shorter period that restarts warnings.
    const odd = { ...saved, periodDays: 403 };
    expect(toPoliciesPatch("surveys", toPolicyFormValues(odd), odd)).toBeNull();
    expect(toPoliciesPatch("surveys", { ...toPolicyFormValues(odd), customPeriodAmount: 2.5 }, odd)).toEqual({
      surveys: { periodDays: 913 },
    });
  });

  test("compares conditions as a set, and sends them in canonical order when they change", () => {
    const reordered = {
      ...toPolicyFormValues(saved),
      conditions: ["noChange", "noResponse"] as const,
    };
    expect(
      toPoliciesPatch("surveys", { ...reordered, conditions: [...reordered.conditions] }, saved)
    ).toBeNull();

    const changed = {
      ...toPolicyFormValues(saved),
      conditions: ["createdBefore" as const, "noResponse" as const],
    };
    expect(toPoliciesPatch("surveys", changed, saved)).toEqual({
      surveys: { conditions: ["noResponse", "createdBefore"] },
    });
  });

  test("names each policy's period field", () => {
    const responses = {
      ...toPolicyFormValues(RETENTION_POLICY_DEFAULTS.responses),
      periodPreset: "365",
    };
    expect(toPoliciesPatch("responses", responses, RETENTION_POLICY_DEFAULTS.responses)).toEqual({
      responses: { periodDays: 365 },
    });
    const members = { ...toPolicyFormValues(RETENTION_POLICY_DEFAULTS.members), enabled: true };
    expect(toPoliciesPatch("members", members, RETENTION_POLICY_DEFAULTS.members)).toEqual({
      members: { enabled: true },
    });
  });
});
