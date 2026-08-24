import { createId } from "@paralleldrive/cuid2";
import { describe, expect, test } from "vitest";
import {
  MAX_SEGMENT_FILTERS_PER_TREE,
  MAX_SEGMENT_FILTER_DEPTH,
  MAX_SEGMENT_SURVEYS,
  MAX_SEGMENT_SURVEY_INTERACTION_IDS_PER_TREE,
  type TBaseFilters,
  type TSurveyInteractionOperator,
  ZSegmentCreateInput,
  ZSegmentFilters,
  ZSegmentSurveyInteractionFilterValue,
  ZSegmentUpdateInput,
  buildSurveyInteractionRefreshMap,
} from "@formbricks/types/segment";

const surveyInteractionFilter = (value: unknown) => [
  {
    id: createId(),
    connector: null,
    resource: {
      id: createId(),
      root: { type: "surveyInteraction" as const },
      qualifier: { operator: "haveSeen" as const },
      value,
    },
  },
];

const validFilters = [
  {
    id: createId(),
    connector: null,
    resource: {
      id: createId(),
      root: {
        type: "attribute" as const,
        contactAttributeKey: "email",
      },
      value: "user@example.com",
      qualifier: {
        operator: "equals" as const,
      },
    },
  },
];

describe("segment schema validation", () => {
  test("keeps base segment filters compatible with empty arrays", () => {
    const result = ZSegmentFilters.safeParse([]);

    expect(result.success).toBe(true);
  });

  test("requires at least one filter when creating a segment", () => {
    const result = ZSegmentCreateInput.safeParse({
      workspaceId: "workspaceId",
      title: "Power users",
      description: "Users with a matching email",
      isPrivate: false,
      filters: [],
      surveyId: "surveyId",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("At least one filter is required");
  });

  test("accepts segment creation with a valid filter", () => {
    const result = ZSegmentCreateInput.safeParse({
      workspaceId: "workspaceId",
      title: "Power users",
      description: "Users with a matching email",
      isPrivate: false,
      filters: validFilters,
      surveyId: "surveyId",
    });

    expect(result.success).toBe(true);
  });

  test("requires at least one filter when updating a segment", () => {
    const result = ZSegmentUpdateInput.safeParse({
      filters: [],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("At least one filter is required");
  });

  test("accepts segment updates with a valid filter", () => {
    const result = ZSegmentUpdateInput.safeParse({
      filters: validFilters,
    });

    expect(result.success).toBe(true);
  });

  test("accepts a linked survey list at the cap", () => {
    const result = ZSegmentUpdateInput.safeParse({
      surveys: Array.from({ length: MAX_SEGMENT_SURVEYS }, () => createId()),
    });

    expect(result.success).toBe(true);
  });

  test("rejects a linked survey list over the cap", () => {
    const result = ZSegmentUpdateInput.safeParse({
      surveys: Array.from({ length: MAX_SEGMENT_SURVEYS + 1 }, () => createId()),
    });

    expect(result.success).toBe(false);
  });

  test("rejects a linked survey id that is not a valid id", () => {
    const result = ZSegmentUpdateInput.safeParse({
      surveys: ["not-a-valid-id"],
    });

    expect(result.success).toBe(false);
  });

  test("accepts an empty linked survey list", () => {
    const result = ZSegmentUpdateInput.safeParse({
      surveys: [],
    });

    expect(result.success).toBe(true);
  });
});

describe("segment filter tree bounds", () => {
  const attributeLeaf = (connector: "and" | null) => ({
    id: createId(),
    connector,
    resource: {
      id: createId(),
      root: { type: "attribute" as const, contactAttributeKey: "email" },
      value: "user@example.com",
      qualifier: { operator: "equals" as const },
    },
  });

  const flatTree = (length: number) =>
    Array.from({ length }, (_, index) => attributeLeaf(index === 0 ? null : "and"));

  // One group node per level around a single innermost leaf: depth === node count. Built with a
  // loop on purpose — a recursive builder would blow the stack on the deep trees this exercises.
  const leftSpine = (depth: number): unknown[] => {
    let filters: unknown[] = [attributeLeaf(null)];
    for (let level = 1; level < depth; level++) {
      filters = [{ id: createId(), connector: null, resource: filters }];
    }
    return filters;
  };

  const interactionLeaf = (connector: "and" | null, surveyIdCount: number) => ({
    id: createId(),
    connector,
    resource: {
      id: createId(),
      root: { type: "surveyInteraction" as const },
      qualifier: { operator: "haveSeen" as const },
      value: {
        surveyScope: "specific" as const,
        surveyIds: Array.from({ length: surveyIdCount }, () => createId()),
        within: { amount: 1, unit: "months" as const },
      },
    },
  });

  const interactionTree = (filterCount: number, surveyIdsPerFilter: number) =>
    Array.from({ length: filterCount }, (_, index) =>
      interactionLeaf(index === 0 ? null : "and", surveyIdsPerFilter)
    );

  test("accepts a flat tree with exactly the maximum number of filters", () => {
    const result = ZSegmentFilters.safeParse(flatTree(MAX_SEGMENT_FILTERS_PER_TREE));

    expect(result.success).toBe(true);
  });

  test("rejects a flat tree one filter over the cap", () => {
    const result = ZSegmentFilters.safeParse(flatTree(MAX_SEGMENT_FILTERS_PER_TREE + 1));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Too many filters: a segment supports at most ${MAX_SEGMENT_FILTERS_PER_TREE} filters in total`
    );
  });

  test("rejects an over-cap tree hidden behind nesting (small arrays at every level)", () => {
    // Each wrap keeps the per-level array at 25 entries (24 leaves + 1 nested group) and the depth
    // within MAX_SEGMENT_FILTER_DEPTH, so any per-level `.max()` (and the depth bound) would pass —
    // only the whole-tree node bound catches the total.
    let filters: unknown[] = flatTree(25);
    let nodeCount = 25;
    while (nodeCount <= MAX_SEGMENT_FILTERS_PER_TREE) {
      filters = [...flatTree(24), { id: createId(), connector: "and" as const, resource: filters }];
      nodeCount += 25;
    }

    const result = ZSegmentFilters.safeParse(filters);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Too many filters: a segment supports at most ${MAX_SEGMENT_FILTERS_PER_TREE} filters in total`
    );
  });

  test("accepts a nested tree under the cap", () => {
    const filters = [...flatTree(3), { id: createId(), connector: "and" as const, resource: flatTree(5) }];

    const result = ZSegmentFilters.safeParse(filters);

    expect(result.success).toBe(true);
  });

  test("rejects an over-cap tree submitted through a segment update", () => {
    const result = ZSegmentUpdateInput.safeParse({
      filters: flatTree(MAX_SEGMENT_FILTERS_PER_TREE + 1),
    });

    expect(result.success).toBe(false);
  });

  test("a deep left-spine tree within the node cap fails with a clean depth issue, not a RangeError", () => {
    // Regression: depth === MAX_SEGMENT_FILTERS_PER_TREE nodes is within the node cap, but deep
    // enough that the recursive parse alone would overflow the call stack (safeParse does not catch
    // RangeError). The bounds gate must reject it BEFORE the recursive parse ever runs.
    const result = ZSegmentFilters.safeParse(leftSpine(MAX_SEGMENT_FILTERS_PER_TREE));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Segment filters are nested too deeply: at most ${MAX_SEGMENT_FILTER_DEPTH} levels are supported`
    );
  });

  test("accepts a tree nested exactly at the depth limit", () => {
    const result = ZSegmentFilters.safeParse(leftSpine(MAX_SEGMENT_FILTER_DEPTH));

    expect(result.success).toBe(true);
  });

  test("rejects a tree nested one level over the depth limit", () => {
    const result = ZSegmentFilters.safeParse(leftSpine(MAX_SEGMENT_FILTER_DEPTH + 1));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Segment filters are nested too deeply: at most ${MAX_SEGMENT_FILTER_DEPTH} levels are supported`
    );
  });

  test("accepts survey-interaction filters totalling exactly the tree-wide id cap", () => {
    // 10 filters x 100 ids: each filter at its own per-filter cap, tree total exactly at the bound.
    const result = ZSegmentFilters.safeParse(
      interactionTree(10, MAX_SEGMENT_SURVEY_INTERACTION_IDS_PER_TREE / 10)
    );

    expect(result.success).toBe(true);
  });

  test("rejects survey-interaction filters totalling one id over the tree-wide cap", () => {
    // 11 filters x 91 ids = 1001: every filter is under the per-filter cap (100), so only the
    // tree-wide total can catch it.
    const result = ZSegmentFilters.safeParse(interactionTree(11, 91));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Too many surveys referenced: survey-interaction filters may reference at most ${MAX_SEGMENT_SURVEY_INTERACTION_IDS_PER_TREE} surveys in total`
    );
  });
});

describe("survey interaction filter value validation", () => {
  test("accepts any-survey scope with empty surveyIds", () => {
    const result = ZSegmentSurveyInteractionFilterValue.safeParse({
      surveyScope: "any",
      surveyIds: [],
      within: { amount: 1, unit: "months" },
    });

    expect(result.success).toBe(true);
  });

  test("accepts specific scope with at least one survey", () => {
    const result = ZSegmentSurveyInteractionFilterValue.safeParse({
      surveyScope: "specific",
      surveyIds: [createId()],
      within: { amount: 3, unit: "weeks" },
    });

    expect(result.success).toBe(true);
  });

  test("rejects a surveyId that is not a valid id", () => {
    const result = ZSegmentSurveyInteractionFilterValue.safeParse({
      surveyScope: "specific",
      surveyIds: ["not-a-valid-id"],
      within: { amount: 1, unit: "months" },
    });

    expect(result.success).toBe(false);
  });

  test("rejects specific scope with empty surveyIds", () => {
    const result = ZSegmentSurveyInteractionFilterValue.safeParse({
      surveyScope: "specific",
      surveyIds: [],
      within: { amount: 1, unit: "months" },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Select at least one survey");
  });

  test.each([
    { description: "below 1", amount: 0 },
    { description: "above 999", amount: 1000 },
    { description: "non-integer", amount: 2.5 },
  ])("rejects amount $description", ({ amount }) => {
    const result = ZSegmentSurveyInteractionFilterValue.safeParse({
      surveyScope: "any",
      surveyIds: [],
      within: { amount, unit: "days" },
    });

    expect(result.success).toBe(false);
  });

  test("rejects unsupported time unit", () => {
    const result = ZSegmentSurveyInteractionFilterValue.safeParse({
      surveyScope: "any",
      surveyIds: [],
      within: { amount: 1, unit: "years" },
    });

    expect(result.success).toBe(false);
  });

  test("accepts a full survey interaction filter through ZSegmentFilters", () => {
    const result = ZSegmentFilters.safeParse(
      surveyInteractionFilter({
        surveyScope: "specific",
        surveyIds: [createId(), createId()],
        within: { amount: 6, unit: "months" },
      })
    );

    expect(result.success).toBe(true);
  });

  test("rejects a survey interaction filter with an invalid value through ZSegmentFilters", () => {
    const result = ZSegmentFilters.safeParse(
      surveyInteractionFilter({
        surveyScope: "specific",
        surveyIds: [],
        within: { amount: 1, unit: "months" },
      })
    );

    expect(result.success).toBe(false);
  });
});

describe("buildSurveyInteractionRefreshMap", () => {
  const interactionLeaf = (
    operator: TSurveyInteractionOperator,
    surveyScope: "any" | "specific",
    surveyIds: string[] = []
  ) => ({
    id: createId(),
    connector: null,
    resource: {
      id: createId(),
      root: { type: "surveyInteraction" as const },
      qualifier: { operator },
      value: { surveyScope, surveyIds, within: { amount: 1, unit: "months" as const } },
    },
  });

  const segmentRefLeaf = (segmentId: string) => ({
    id: createId(),
    connector: null,
    resource: {
      id: createId(),
      root: { type: "segment" as const, segmentId },
      qualifier: { operator: "userIsIn" as const },
      value: segmentId,
    },
  });

  const noResolver = () => undefined;

  test("no interaction filters -> all-false map, hasAny false", () => {
    const { refreshBySurveyId, hasAny } = buildSurveyInteractionRefreshMap(
      [{ id: "A", segmentFilters: null }],
      noResolver
    );
    expect(hasAny).toBe(false);
    expect(refreshBySurveyId.A).toEqual({ onDisplay: false, onResponse: false, onFinished: false });
  });

  test("maps each operator to the right source on the referenced (target) survey", () => {
    // B's segment references A across all three interaction kinds; the bit lands on A, not B.
    const surveys = [
      { id: "A", segmentFilters: null },
      {
        id: "B",
        segmentFilters: [
          interactionLeaf("haveSeen", "specific", ["A"]),
          interactionLeaf("haveStartedRespondingTo", "specific", ["A"]),
          interactionLeaf("haveCompleted", "specific", ["A"]),
        ] as unknown as TBaseFilters,
      },
    ];
    const { refreshBySurveyId, hasAny } = buildSurveyInteractionRefreshMap(surveys, noResolver);
    expect(hasAny).toBe(true);
    expect(refreshBySurveyId.A).toEqual({ onDisplay: true, onResponse: true, onFinished: true });
    expect(refreshBySurveyId.B).toEqual({ onDisplay: false, onResponse: false, onFinished: false });
  });

  test("the seen-only example: B refers to A via 'have seen' -> A.onDisplay only, B untouched", () => {
    const surveys = [
      { id: "A", segmentFilters: null },
      {
        id: "B",
        segmentFilters: [interactionLeaf("haveSeen", "specific", ["A"])] as unknown as TBaseFilters,
      },
    ];
    const { refreshBySurveyId } = buildSurveyInteractionRefreshMap(surveys, noResolver);
    expect(refreshBySurveyId.A).toEqual({ onDisplay: true, onResponse: false, onFinished: false });
    expect(refreshBySurveyId.B).toEqual({ onDisplay: false, onResponse: false, onFinished: false });
  });

  test("negative operators map to the same source as their positive counterpart", () => {
    const surveys = [
      { id: "A", segmentFilters: null },
      {
        id: "B",
        segmentFilters: [
          interactionLeaf("haveNotSeen", "specific", ["A"]),
          interactionLeaf("haveNotCompleted", "specific", ["A"]),
        ] as unknown as TBaseFilters,
      },
    ];
    const { refreshBySurveyId } = buildSurveyInteractionRefreshMap(surveys, noResolver);
    expect(refreshBySurveyId.A).toEqual({ onDisplay: true, onResponse: false, onFinished: true });
  });

  test("'any' scope sets the source bit on every delivered survey", () => {
    const surveys = [
      { id: "A", segmentFilters: [interactionLeaf("haveSeen", "any")] as unknown as TBaseFilters },
      { id: "B", segmentFilters: null },
      { id: "C", segmentFilters: null },
    ];
    const { refreshBySurveyId } = buildSurveyInteractionRefreshMap(surveys, noResolver);
    for (const id of ["A", "B", "C"]) {
      expect(refreshBySurveyId[id].onDisplay).toBe(true);
    }
  });

  test("a target outside the delivered set is ignored (no bit, hasAny stays false)", () => {
    const surveys = [
      {
        id: "A",
        segmentFilters: [
          interactionLeaf("haveSeen", "specific", ["not-delivered"]),
        ] as unknown as TBaseFilters,
      },
    ];
    const { refreshBySurveyId, hasAny } = buildSurveyInteractionRefreshMap(surveys, noResolver);
    expect(hasAny).toBe(false);
    expect(refreshBySurveyId.A.onDisplay).toBe(false);
  });

  test("resolves an interaction filter hidden inside a nested userIsIn segment", () => {
    // A's segment only references segment "seg1" (userIsIn); seg1 holds the interaction leaf on B.
    const surveys = [
      { id: "A", segmentFilters: [segmentRefLeaf("seg1")] as unknown as TBaseFilters },
      { id: "B", segmentFilters: null },
    ];
    const resolve = (segmentId: string) =>
      segmentId === "seg1"
        ? ([interactionLeaf("haveCompleted", "specific", ["B"])] as unknown as TBaseFilters)
        : undefined;
    const { refreshBySurveyId, hasAny } = buildSurveyInteractionRefreshMap(surveys, resolve);
    expect(hasAny).toBe(true);
    expect(refreshBySurveyId.B.onFinished).toBe(true);
  });

  test("terminates on a segment-reference cycle", () => {
    const surveys = [{ id: "A", segmentFilters: [segmentRefLeaf("seg1")] as unknown as TBaseFilters }];
    // seg1 -> seg2 -> seg1 (cycle), with an interaction leaf on A tucked into seg2.
    const resolve = (segmentId: string) => {
      if (segmentId === "seg1") return [segmentRefLeaf("seg2")] as unknown as TBaseFilters;
      if (segmentId === "seg2")
        return [
          segmentRefLeaf("seg1"),
          interactionLeaf("haveSeen", "specific", ["A"]),
        ] as unknown as TBaseFilters;
      return undefined;
    };
    const { refreshBySurveyId, hasAny } = buildSurveyInteractionRefreshMap(surveys, resolve);
    expect(hasAny).toBe(true);
    expect(refreshBySurveyId.A.onDisplay).toBe(true);
  });

  test("unresolved (deleted / foreign) nested segment ref is skipped", () => {
    const surveys = [{ id: "A", segmentFilters: [segmentRefLeaf("missing")] as unknown as TBaseFilters }];
    const { hasAny } = buildSurveyInteractionRefreshMap(surveys, noResolver);
    expect(hasAny).toBe(false);
  });
});
