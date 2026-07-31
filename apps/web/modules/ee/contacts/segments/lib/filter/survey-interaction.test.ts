import { describe, expect, test } from "vitest";
import {
  TBaseFilters,
  TSegmentSurveyInteractionFilter,
  TSurveyInteractionOperator,
} from "@formbricks/types/segment";
import {
  type TContactInteractionData,
  combineFilterResults,
  evaluateSurveyInteractionFilterInMemory,
  getSurveyInteractionWindowStart,
  tryEvaluateSurveyInteractionSegmentInMemory,
} from "./survey-interaction";

// Fixed evaluation instant so window math is deterministic.
const NOW = new Date("2026-07-21T12:00:00.000Z");
const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const buildFilter = (
  operator: TSurveyInteractionOperator,
  overrides: Partial<TSegmentSurveyInteractionFilter["value"]> = {}
): TSegmentSurveyInteractionFilter => ({
  id: "wq3n1x0m8p2v6t4r9y7k5c1a",
  root: { type: "surveyInteraction" },
  qualifier: { operator },
  value: {
    surveyScope: "any",
    surveyIds: [],
    within: { amount: 30, unit: "days" },
    ...overrides,
  },
});

const emptyData: TContactInteractionData = { displays: [], responses: [] };

describe("getSurveyInteractionWindowStart", () => {
  test("subtracts the configured window from now", () => {
    const value = buildFilter("haveSeen").value;
    expect(getSurveyInteractionWindowStart(value, NOW)).toEqual(daysAgo(30));
  });
});

describe("evaluateSurveyInteractionFilterInMemory", () => {
  describe("haveSeen / haveNotSeen (displays)", () => {
    test("haveSeen matches a display inside the window", () => {
      const data: TContactInteractionData = {
        displays: [{ surveyId: "s1", createdAt: daysAgo(5) }],
        responses: [],
      };
      expect(evaluateSurveyInteractionFilterInMemory(buildFilter("haveSeen"), data, NOW)).toBe(true);
    });

    test("haveSeen ignores a display older than the window", () => {
      const data: TContactInteractionData = {
        displays: [{ surveyId: "s1", createdAt: daysAgo(31) }],
        responses: [],
      };
      expect(evaluateSurveyInteractionFilterInMemory(buildFilter("haveSeen"), data, NOW)).toBe(false);
    });

    test("haveNotSeen is the negation of haveSeen", () => {
      expect(evaluateSurveyInteractionFilterInMemory(buildFilter("haveNotSeen"), emptyData, NOW)).toBe(true);
      const data: TContactInteractionData = {
        displays: [{ surveyId: "s1", createdAt: daysAgo(5) }],
        responses: [],
      };
      expect(evaluateSurveyInteractionFilterInMemory(buildFilter("haveNotSeen"), data, NOW)).toBe(false);
    });

    test("does not count responses as 'seen'", () => {
      const data: TContactInteractionData = {
        displays: [],
        responses: [{ surveyId: "s1", createdAt: daysAgo(1), finished: true }],
      };
      expect(evaluateSurveyInteractionFilterInMemory(buildFilter("haveSeen"), data, NOW)).toBe(false);
    });
  });

  describe("started / completed (responses)", () => {
    const startedData: TContactInteractionData = {
      displays: [],
      responses: [{ surveyId: "s1", createdAt: daysAgo(2), finished: false }],
    };

    test("haveStartedRespondingTo matches an unfinished response", () => {
      expect(
        evaluateSurveyInteractionFilterInMemory(buildFilter("haveStartedRespondingTo"), startedData, NOW)
      ).toBe(true);
    });

    test("haveCompleted requires finished=true", () => {
      expect(evaluateSurveyInteractionFilterInMemory(buildFilter("haveCompleted"), startedData, NOW)).toBe(
        false
      );
      const completedData: TContactInteractionData = {
        displays: [],
        responses: [{ surveyId: "s1", createdAt: daysAgo(2), finished: true }],
      };
      expect(evaluateSurveyInteractionFilterInMemory(buildFilter("haveCompleted"), completedData, NOW)).toBe(
        true
      );
    });

    test("haveNotCompleted is the negation of haveCompleted", () => {
      expect(evaluateSurveyInteractionFilterInMemory(buildFilter("haveNotCompleted"), startedData, NOW)).toBe(
        true
      );
    });
  });

  describe("survey scope", () => {
    const data: TContactInteractionData = {
      displays: [{ surveyId: "s1", createdAt: daysAgo(1) }],
      responses: [],
    };

    test("specific scope matches only the listed surveys", () => {
      expect(
        evaluateSurveyInteractionFilterInMemory(
          buildFilter("haveSeen", { surveyScope: "specific", surveyIds: ["s1"] }),
          data,
          NOW
        )
      ).toBe(true);
      expect(
        evaluateSurveyInteractionFilterInMemory(
          buildFilter("haveSeen", { surveyScope: "specific", surveyIds: ["other"] }),
          data,
          NOW
        )
      ).toBe(false);
    });
  });

  test("window boundary is inclusive (createdAt exactly at windowStart matches)", () => {
    const data: TContactInteractionData = {
      displays: [{ surveyId: "s1", createdAt: daysAgo(30) }],
      responses: [],
    };
    expect(evaluateSurveyInteractionFilterInMemory(buildFilter("haveSeen"), data, NOW)).toBe(true);
  });
});

describe("combineFilterResults", () => {
  test("empty input is false", () => {
    expect(combineFilterResults([])).toBe(false);
  });

  test("single result is passed through", () => {
    expect(combineFilterResults([{ result: true, connector: null }])).toBe(true);
    expect(combineFilterResults([{ result: false, connector: null }])).toBe(false);
  });

  test("AND requires all in the group", () => {
    expect(
      combineFilterResults([
        { result: true, connector: null },
        { result: false, connector: "and" },
      ])
    ).toBe(false);
  });

  test("OR matches if any group matches", () => {
    expect(
      combineFilterResults([
        { result: false, connector: null },
        { result: true, connector: "or" },
      ])
    ).toBe(true);
  });

  test("AND binds tighter than OR", () => {
    // false AND true OR true => (false && true) || true => true
    expect(
      combineFilterResults([
        { result: false, connector: null },
        { result: true, connector: "and" },
        { result: true, connector: "or" },
      ])
    ).toBe(true);
    // true AND false OR false => (true && false) || false => false
    expect(
      combineFilterResults([
        { result: true, connector: null },
        { result: false, connector: "and" },
        { result: false, connector: "or" },
      ])
    ).toBe(false);
  });
});

describe("tryEvaluateSurveyInteractionSegmentInMemory", () => {
  const asFilters = (resources: unknown[]): TBaseFilters =>
    resources.map((resource, i) => ({
      id: `f${i}`,
      connector: i === 0 ? null : "and",
      resource,
    })) as TBaseFilters;

  test("returns null for empty filters (defers to always-match handling)", () => {
    expect(tryEvaluateSurveyInteractionSegmentInMemory([], emptyData, NOW)).toBeNull();
  });

  test("evaluates a pure interaction segment to a boolean", () => {
    const data: TContactInteractionData = {
      displays: [{ surveyId: "s1", createdAt: daysAgo(1) }],
      responses: [],
    };
    expect(tryEvaluateSurveyInteractionSegmentInMemory(asFilters([buildFilter("haveSeen")]), data, NOW)).toBe(
      true
    );
  });

  test("returns null when any leaf is a non-interaction filter", () => {
    const attributeFilter = {
      id: "attr",
      root: { type: "attribute", contactAttributeKey: "plan" },
      qualifier: { operator: "equals" },
      value: "pro",
    };
    const result = tryEvaluateSurveyInteractionSegmentInMemory(
      asFilters([buildFilter("haveSeen"), attributeFilter]),
      emptyData,
      NOW
    );
    expect(result).toBeNull();
  });

  test("returns null for a malformed node (no root, not a group)", () => {
    expect(tryEvaluateSurveyInteractionSegmentInMemory(asFilters([{}]), emptyData, NOW)).toBeNull();
  });

  test("recurses into nested interaction-only groups", () => {
    const data: TContactInteractionData = {
      displays: [{ surveyId: "s1", createdAt: daysAgo(1) }],
      responses: [],
    };
    const nested = asFilters([buildFilter("haveSeen")]);
    const filters = [{ id: "group", connector: null, resource: nested }] as TBaseFilters;
    expect(tryEvaluateSurveyInteractionSegmentInMemory(filters, data, NOW)).toBe(true);
  });

  test("returns null when a nested group contains a non-interaction filter", () => {
    const attributeFilter = {
      id: "attr",
      root: { type: "attribute", contactAttributeKey: "plan" },
      qualifier: { operator: "equals" },
      value: "pro",
    };
    const nested = asFilters([attributeFilter]);
    const filters = [{ id: "group", connector: null, resource: nested }] as TBaseFilters;
    expect(tryEvaluateSurveyInteractionSegmentInMemory(filters, emptyData, NOW)).toBeNull();
  });
});
