import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import {
  EXEMPTION_REASON_MAX_LENGTH,
  getAddExemptionFormSchema,
  getExemptionUntilBounds,
  toCreateRetentionExemptionInput,
} from "./exemption-form";

const t = ((key: string) => key) as unknown as TFunction;
const survey = { id: "clsrv11111111111111111111", name: "Site visit feedback", workspaceName: "Europe" };

describe("getAddExemptionFormSchema", () => {
  const schema = getAddExemptionFormSchema(t);
  const valid = { survey, policy: "surveys", until: new Date(2031, 2, 31), reason: " Supplier audit " };

  test("accepts a complete form", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  test.each([
    ["no survey", { survey: null }, "workspace.settings.data_retention.survey_required"],
    ["no end date", { until: null }, "workspace.settings.data_retention.until_required"],
    ["a blank reason", { reason: "   " }, "workspace.settings.data_retention.reason_required"],
    [
      "a reason over the limit",
      { reason: "x".repeat(EXEMPTION_REASON_MAX_LENGTH + 1) },
      "workspace.settings.data_retention.reason_too_long",
    ],
  ])("refuses %s", (_case, override, message) => {
    const result = schema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  test("refuses the members policy, which can't be exempted", () => {
    expect(schema.safeParse({ ...valid, policy: "members" }).success).toBe(false);
  });
});

describe("getExemptionUntilBounds", () => {
  test("offers today to the last day that still ends within ten years, in the organisation's zone", () => {
    // 23:30 in UTC is already the next day in Berlin.
    const now = new Date("2030-03-30T23:30:00.000Z");

    expect(getExemptionUntilBounds(now, "Europe/Berlin")).toEqual({
      minDay: new Date(2030, 2, 31),
      maxDay: new Date(2040, 2, 30),
    });
    expect(getExemptionUntilBounds(now, "UTC")).toEqual({
      minDay: new Date(2030, 2, 30),
      maxDay: new Date(2040, 2, 29),
    });
  });
});

describe("toCreateRetentionExemptionInput", () => {
  test("ends the exemption at the last millisecond of the chosen day in the organisation's zone", () => {
    expect(
      toCreateRetentionExemptionInput(
        { survey, policy: "responses", until: new Date(2031, 2, 31), reason: " Supplier audit " },
        "Europe/Berlin"
      )
    ).toEqual({
      surveyId: survey.id,
      policy: "responses",
      until: "2031-03-31T21:59:59.999Z",
      reason: "Supplier audit",
    });
  });

  test("refuses an incomplete form rather than sending it", () => {
    expect(() =>
      toCreateRetentionExemptionInput({ survey: null, policy: "surveys", until: null, reason: "x" }, "UTC")
    ).toThrow();
  });
});
