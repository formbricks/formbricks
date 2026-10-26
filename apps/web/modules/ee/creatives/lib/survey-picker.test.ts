import { describe, expect, test } from "vitest";
import type { TDestinationSurveyOption } from "./destination-options";
import { getSurveyPickState, withPinnedSurveyOptions } from "./survey-picker";

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

describe("withPinnedSurveyOptions", () => {
  test("keeps the chosen and the linked survey listed when the search doesn't return them", () => {
    const picked = option({ id: "picked", name: "Plan finder" });
    const linked = option({ id: "linked", name: "Old survey" });
    const results = [option({ id: "match", name: "Matching" })];

    expect(withPinnedSurveyOptions(results, [picked, linked]).map(({ id }) => id)).toEqual([
      "picked",
      "linked",
      "match",
    ]);
  });

  test("lists a survey once, as the creative read it, so a linked survey keeps its flag", () => {
    const linked = option({ id: "linked", visibility: "restricted", notAllowed: true });
    const results = [option({ id: "linked", visibility: "restricted" }), option({ id: "other" })];

    expect(withPinnedSurveyOptions(results, [linked, linked])).toEqual([linked, results[1]]);
  });

  test("lists only the results when nothing is chosen or linked", () => {
    const results = [option({ id: "a" }), option({ id: "b" })];
    expect(withPinnedSurveyOptions(results, [null, null])).toEqual(results);
  });
});
