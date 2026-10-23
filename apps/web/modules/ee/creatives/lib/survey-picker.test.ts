import { describe, expect, test } from "vitest";
import type { TDestinationSurveyOption } from "./destination-options";
import { getSurveyPickState } from "./survey-picker";

const option = (overrides: Partial<TDestinationSurveyOption> = {}): TDestinationSurveyOption => ({
  id: "survey-1",
  name: "Site feedback",
  type: "app",
  status: "inProgress",
  visibility: "workspace",
  ...overrides,
});

describe("getSurveyPickState", () => {
  test("a workspace survey can be picked and carries no badge", () => {
    expect(getSurveyPickState(option(), null)).toEqual({ disabled: false, badge: null });
  });

  test("a Restricted survey stays listed but can't be picked", () => {
    expect(getSurveyPickState(option({ visibility: "restricted" }), null)).toEqual({
      disabled: true,
      badge: "restricted",
    });
  });

  test("the survey the creative already opens stays selectable even when it became Restricted", () => {
    const linked = option({ visibility: "restricted", notAllowed: true });
    expect(getSurveyPickState(linked, linked.id)).toEqual({ disabled: false, badge: "notAllowed" });
  });

  test("another creative's link doesn't unlock a Restricted survey", () => {
    expect(getSurveyPickState(option({ visibility: "restricted" }), "survey-2")).toEqual({
      disabled: true,
      badge: "restricted",
    });
  });
});
