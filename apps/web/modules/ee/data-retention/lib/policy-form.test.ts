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
    expect(toPolicyFormValues("surveys", RETENTION_POLICY_DEFAULTS.surveys)).toMatchObject({
      periodPreset: "1095",
      warnPreset: "60",
      conditions: ["noResponse", "noChange"],
    });
  });

  test("falls back to the custom inputs, in the largest unit that fits", () => {
    expect(
      toPolicyFormValues("responses", {
        ...RETENTION_POLICY_DEFAULTS.responses,
        deleteDays: 180,
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

  test("give null for an empty, fractional or non-positive custom value", () => {
    for (const amount of [null, 1.5, 0, -3]) {
      expect(
        getPolicyFormPeriodDays({
          periodPreset: CUSTOM,
          customPeriodAmount: amount,
          customPeriodUnit: "days",
        })
      ).toBeNull();
    }
    expect(getPolicyFormWarnDays({ warnPreset: CUSTOM, customWarnDays: 40.5 })).toBeNull();
  });
});

describe("getPolicyFormSchema", () => {
  const valid = toPolicyFormValues("surveys", RETENTION_POLICY_DEFAULTS.surveys);

  test("accepts the defaults", () => {
    expect(getPolicyFormSchema(t, "surveys").safeParse(valid).success).toBe(true);
  });

  test.each([
    [
      "a period under 30 days",
      { periodPreset: CUSTOM, customPeriodAmount: 29, customPeriodUnit: "days" },
      "customPeriodAmount",
    ],
    [
      "a period over 10 years",
      { periodPreset: CUSTOM, customPeriodAmount: 11, customPeriodUnit: "years" },
      "customPeriodAmount",
    ],
    ["an empty custom period", { periodPreset: CUSTOM, customPeriodAmount: null }, "customPeriodAmount"],
    ["a notice under 30 days", { warnPreset: CUSTOM, customWarnDays: 20 }, "customWarnDays"],
    ["no survey condition", { conditions: [] }, "conditions"],
  ] as const)("refuses %s", (_case, override, path) => {
    const result = getPolicyFormSchema(t, "surveys").safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([path]);
  });

  test("doesn't ask other policies for conditions", () => {
    const members = toPolicyFormValues("members", RETENTION_POLICY_DEFAULTS.members);
    expect(getPolicyFormSchema(t, "members").safeParse(members).success).toBe(true);
  });
});

describe("toPolicyPatch", () => {
  test("sends the fields the dialog edits, under each policy's period field", () => {
    const values = { ...toPolicyFormValues("surveys", RETENTION_POLICY_DEFAULTS.surveys), enabled: true };
    expect(toPolicyPatch("surveys", { ...values, conditions: ["createdBefore", "noResponse"] })).toEqual({
      enabled: true,
      warnDays: 60,
      archiveDays: 1095,
      conditions: ["noResponse", "createdBefore"],
    });
    expect(
      toPolicyPatch("responses", toPolicyFormValues("responses", RETENTION_POLICY_DEFAULTS.responses))
    ).toEqual({
      enabled: false,
      warnDays: 60,
      deleteDays: 1095,
    });
  });

  test("refuses an invalid form rather than sending it", () => {
    const values = toPolicyFormValues("members", RETENTION_POLICY_DEFAULTS.members);
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
    const values = { ...toPolicyFormValues("surveys", saved), warnPreset: "30" };

    expect(toPoliciesPatch("surveys", values, saved)).toEqual({ surveys: { warnDays: 30 } });
  });

  test("compares conditions as a set, and sends them in canonical order when they change", () => {
    const reordered = {
      ...toPolicyFormValues("surveys", saved),
      conditions: ["noChange", "noResponse"] as const,
    };
    expect(
      toPoliciesPatch("surveys", { ...reordered, conditions: [...reordered.conditions] }, saved)
    ).toBeNull();

    const changed = {
      ...toPolicyFormValues("surveys", saved),
      conditions: ["createdBefore" as const, "noResponse" as const],
    };
    expect(toPoliciesPatch("surveys", changed, saved)).toEqual({
      surveys: { conditions: ["noResponse", "createdBefore"] },
    });
  });

  test("names each policy's period field", () => {
    const responses = {
      ...toPolicyFormValues("responses", RETENTION_POLICY_DEFAULTS.responses),
      periodPreset: "365",
    };
    expect(toPoliciesPatch("responses", responses, RETENTION_POLICY_DEFAULTS.responses)).toEqual({
      responses: { deleteDays: 365 },
    });
    const members = { ...toPolicyFormValues("members", RETENTION_POLICY_DEFAULTS.members), enabled: true };
    expect(toPoliciesPatch("members", members, RETENTION_POLICY_DEFAULTS.members)).toEqual({
      members: { enabled: true },
    });
  });
});
