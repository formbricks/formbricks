import { describe, expect, test } from "vitest";
import type { TBaseFilter, TBaseFilters } from "@formbricks/types/segment";
import {
  redactSegmentFilterSurveyIds,
  restoreHiddenSurveyIds,
  segmentFiltersReferenceSegment,
} from "./filter-survey-ids";

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

describe("segmentFiltersReferenceSegment", () => {
  const nested = (id: string, segmentId: string): TBaseFilter =>
    ({
      id,
      connector: null,
      resource: {
        id: `${id}-resource`,
        root: { type: "segment", segmentId },
        qualifier: { operator: "userIsIn" },
        value: "",
      },
    }) as unknown as TBaseFilter;

  test("a direct reference is found", () => {
    expect(segmentFiltersReferenceSegment([nested("f1", "target")], "target")).toBe(true);
  });

  test("a reference inside a nested group is found", () => {
    const filters: TBaseFilters = [
      interaction("f1", ["survey"]),
      { id: "g1", connector: "and", resource: [nested("f2", "target")] },
    ];
    expect(segmentFiltersReferenceSegment(filters, "target")).toBe(true);
  });

  test("another segment's id, a survey filter and an empty tree read nothing", () => {
    expect(segmentFiltersReferenceSegment([nested("f1", "other")], "target")).toBe(false);
    expect(segmentFiltersReferenceSegment([interaction("f1", ["target"])], "target")).toBe(false);
    expect(segmentFiltersReferenceSegment([], "target")).toBe(false);
  });

  test("a malformed stored tree reads nothing instead of throwing", () => {
    expect(segmentFiltersReferenceSegment(null as unknown as TBaseFilters, "target")).toBe(false);
  });
});
