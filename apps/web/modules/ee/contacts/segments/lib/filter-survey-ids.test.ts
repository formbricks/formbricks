import { describe, expect, test } from "vitest";
import type { TBaseFilter, TBaseFilters } from "@formbricks/types/segment";
import { redactSegmentFilterSurveyIds, restoreHiddenSurveyIds } from "./filter-survey-ids";

const interaction = (id: string, surveyIds: string[]): TBaseFilter =>
  ({
    id,
    connector: null,
    resource: {
      id: `${id}-resource`,
      root: { type: "surveyInteraction" },
      qualifier: { operator: "haveNotSeen" },
      value: { surveyScope: "specific", surveyIds, within: null },
    },
  }) as unknown as TBaseFilter;

const surveyIdsOf = (filters: TBaseFilters): string[][] =>
  filters.map((filter) =>
    Array.isArray(filter.resource)
      ? surveyIdsOf(filter.resource).flat()
      : (filter.resource as unknown as { value: { surveyIds: string[] } }).value.surveyIds
  );

describe("restoreHiddenSurveyIds", () => {
  const visible = new Set(["visible"]);

  test("an editor's save of the redacted tree keeps the ids it could not see", () => {
    const stored = [interaction("f1", ["visible", "hidden"])];
    const saved = redactSegmentFilterSurveyIds(stored, visible);
    expect(surveyIdsOf(saved)).toEqual([["visible"]]);
    expect(surveyIdsOf(restoreHiddenSurveyIds(saved, stored, visible))).toEqual([["visible", "hidden"]]);
  });

  test("hidden ids go back inside nested groups, into the filter they came from", () => {
    const stored: TBaseFilters = [
      interaction("f1", ["visible"]),
      { id: "g1", connector: "and", resource: [interaction("f2", ["hidden"])] },
    ];
    const saved = redactSegmentFilterSurveyIds(stored, visible);
    expect(surveyIdsOf(restoreHiddenSurveyIds(saved, stored, visible))).toEqual([["visible"], ["hidden"]]);
  });

  test("a filter the editor removed takes its hidden ids with it", () => {
    const stored = [interaction("f1", ["hidden"]), interaction("f2", ["visible"])];
    const saved = [interaction("f2", ["visible"])];
    expect(surveyIdsOf(restoreHiddenSurveyIds(saved, stored, visible))).toEqual([["visible"]]);
  });

  test("ids the editor can see are left as edited", () => {
    const stored = [interaction("f1", ["visible", "hidden"])];
    const saved = [interaction("f1", [])];
    expect(surveyIdsOf(restoreHiddenSurveyIds(saved, stored, visible))).toEqual([["hidden"]]);
  });
});
