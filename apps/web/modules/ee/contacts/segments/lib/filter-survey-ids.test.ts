import { describe, expect, test } from "vitest";
import type { TBaseFilter, TBaseFilters } from "@formbricks/types/segment";
import {
  collectChangedFilterSurveyIds,
  findBlockedHiddenFilterIds,
  findUnchangedSurveyFilterIds,
  redactSegmentFilterSurveyIds,
  restoreHiddenSurveyIds,
} from "./filter-survey-ids";

const interaction = (
  id: string,
  surveyIds: string[],
  terms: { operator?: string; scope?: string; within?: { amount: number; unit: string } | null } = {}
): TBaseFilter =>
  ({
    id,
    connector: null,
    resource: {
      id: `${id}-resource`,
      root: { type: "surveyInteraction" },
      qualifier: { operator: terms.operator ?? "haveNotSeen" },
      value: {
        surveyScope: terms.scope ?? "specific",
        surveyIds,
        within: terms.within === undefined ? null : terms.within,
      },
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

  test("removing a visible id changes the filter, so its hidden id is not restored (ENG-6955)", () => {
    const stored = [interaction("f1", ["visible", "hidden"])];
    const saved = [interaction("f1", [])];
    expect(surveyIdsOf(restoreHiddenSurveyIds(saved, stored, visible))).toEqual([[]]);
  });
});

describe("a hidden id is carried over only by an unchanged filter (ENG-6955)", () => {
  const visible = new Set(["visible"]);
  const days30 = { within: { amount: 30, unit: "days" } };
  const stored = [interaction("f1", ["visible", "hidden"], days30)];
  const redacted = (terms: Parameters<typeof interaction>[2], ids = ["visible"]) => [
    interaction("f1", ids, terms),
  ];
  const group = (id: string, ...children: TBaseFilter[]): TBaseFilter =>
    ({ id, connector: "and", resource: children }) as unknown as TBaseFilter;

  test("an unchanged filter keeps its hidden id on restore", () => {
    const saved = redacted(days30);
    expect([...findUnchangedSurveyFilterIds(saved, stored, visible)]).toEqual(["f1"]);
    expect(surveyIdsOf(restoreHiddenSurveyIds(saved, stored, visible))).toEqual([["visible", "hidden"]]);
    expect(findBlockedHiddenFilterIds(saved, stored, visible)).toEqual([]);
  });

  test.each([
    ["operator", { operator: "haveCompleted", ...days30 }],
    ["scope", { scope: "any", ...days30 }],
    ["within amount", { within: { amount: 7, unit: "days" } }],
    ["within unit", { within: { amount: 30, unit: "hours" } }],
    ["within null", { within: null }],
  ])("a changed %s does not restore the hidden id", (name, terms) => {
    const saved = redacted(terms);
    expect(findUnchangedSurveyFilterIds(saved, stored, visible).size).toBe(0);
    expect(surveyIdsOf(restoreHiddenSurveyIds(saved, stored, visible))).toEqual([["visible"]]);
    // A move to scope "any" is a removal of the rule's survey list; the others are refused.
    expect(findBlockedHiddenFilterIds(saved, stored, visible)).toEqual(name === "scope" ? [] : ["f1"]);
  });

  test("a stored within of null only matches a missing one", () => {
    const nullWithin = [interaction("f1", ["visible", "hidden"], { within: null })];
    expect(findUnchangedSurveyFilterIds(redacted({ within: null }), nullWithin, visible).size).toBe(1);
    expect(findUnchangedSurveyFilterIds(redacted(days30), nullWithin, visible).size).toBe(0);
  });

  test("adding or removing a visible survey is a change, so a hidden id cannot be isolated", () => {
    const stored2 = [interaction("f1", ["v1", "v2", "hidden"], days30)];
    const seen = new Set(["v1", "v2", "v3"]);
    for (const ids of [["v1"], ["v1", "v2", "v3"], ["v3", "v2"]]) {
      const saved = [interaction("f1", ids, days30)];
      expect(findUnchangedSurveyFilterIds(saved, stored2, seen).size).toBe(0);
      expect(findBlockedHiddenFilterIds(saved, stored2, seen)).toEqual(["f1"]);
      expect(surveyIdsOf(restoreHiddenSurveyIds(saved, stored2, seen))).toEqual([ids]);
    }
    // The same set in another order is unchanged.
    expect(findUnchangedSurveyFilterIds([interaction("f1", ["v2", "v1"], days30)], stored2, seen).size).toBe(
      1
    );
  });

  test("without a visible set the whole stored id set must match", () => {
    expect(findUnchangedSurveyFilterIds(stored, stored).size).toBe(1);
    expect(findUnchangedSurveyFilterIds(redacted(days30), stored).size).toBe(0);
  });

  test("a filter id duplicated in the incoming tree copies the hidden id nowhere", () => {
    const saved = [interaction("f1", ["visible"], days30), interaction("f1", ["visible"], days30)];
    expect(findUnchangedSurveyFilterIds(saved, stored, visible).size).toBe(0);
    expect(surveyIdsOf(restoreHiddenSurveyIds(saved, stored, visible))).toEqual([["visible"], ["visible"]]);
    expect(findBlockedHiddenFilterIds(saved, stored, visible)).toEqual(["f1"]);
  });

  test("a filter id that appears twice in the stored tree is never unchanged", () => {
    const dup = [interaction("f1", ["visible", "hidden"], days30), interaction("f1", ["x"], days30)];
    expect(findUnchangedSurveyFilterIds([interaction("f1", ["visible"], days30)], dup, visible).size).toBe(0);
  });

  test("a removed filter blocks nothing", () => {
    expect(findBlockedHiddenFilterIds([], stored, visible)).toEqual([]);
  });

  test.each([
    ["became a group", () => [group("f1")]],
    [
      "changed type",
      () => [
        {
          id: "f1",
          connector: null,
          resource: {
            id: "r",
            root: { type: "attribute", contactAttributeKey: "k" },
            value: "x",
            qualifier: { operator: "equals" },
          },
        } as unknown as TBaseFilter,
      ],
    ],
  ])("a filter that %s is a removal: blocked on neither path, ids dropped", (_, build) => {
    const saved = build();
    expect(findUnchangedSurveyFilterIds(saved, stored, visible).size).toBe(0);
    expect(findBlockedHiddenFilterIds(saved, stored, visible)).toEqual([]);
    expect(collectChangedFilterSurveyIds(saved, new Set())).toEqual([]);
  });

  test("a filter nested in a group is matched by id", () => {
    const nestedStored = [group("g1", interaction("f1", ["visible", "hidden"], days30))];
    const same = [group("g1", interaction("f1", ["visible"], days30))];
    expect([...findUnchangedSurveyFilterIds(same, nestedStored, visible)]).toEqual(["f1"]);
    expect(surveyIdsOf(restoreHiddenSurveyIds(same, nestedStored, visible))).toEqual([["visible", "hidden"]]);
    const edited = [group("g1", interaction("f1", ["visible"], { operator: "haveCompleted", ...days30 }))];
    expect(findBlockedHiddenFilterIds(edited, nestedStored, visible)).toEqual(["f1"]);
  });

  test("moving an unchanged filter into or out of a group keeps it unchanged (position is not compared)", () => {
    const moved = [group("g1", interaction("f1", ["visible"], days30))];
    expect([...findUnchangedSurveyFilterIds(moved, stored, visible)]).toEqual(["f1"]);
    const nestedStored = [group("g1", interaction("f1", ["visible", "hidden"], days30))];
    expect([...findUnchangedSurveyFilterIds(redacted(days30), nestedStored, visible)]).toEqual(["f1"]);
  });

  test("collectChangedFilterSurveyIds names the ids of changed specific filters only", () => {
    const incoming = [
      interaction("f1", ["a"], days30),
      interaction("f2", ["b"], days30),
      interaction("f3", ["c"], { scope: "any", ...days30 }),
    ];
    expect(collectChangedFilterSurveyIds(incoming, new Set(["f1"]))).toEqual(["b"]);
  });
});
