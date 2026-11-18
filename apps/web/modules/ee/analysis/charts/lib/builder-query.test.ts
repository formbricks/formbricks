import { describe, expect, test } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import { duplicateFilterNode, parseQueryToState } from "@/modules/ee/analysis/lib/query-builder";
import {
  EMPTY_CHART_BUILDER_STATE,
  toAdoptedQueryJson,
  toBuilderQueryJson,
  toComparableQueryJson,
} from "./builder-query";

const savedQuery: TChartQuery = {
  measures: ["FeedbackRecords.count"],
  filters: [{ member: "FeedbackRecords.sourceType", operator: "equals", values: ["survey"] }],
};

const formFrom = (query: TChartQuery) => ({ ...EMPTY_CHART_BUILDER_STATE, ...parseQueryToState(query) });

describe("toComparableQueryJson", () => {
  test("an untouched form matches the saved query it was loaded from", () => {
    expect(toBuilderQueryJson(formFrom(savedQuery), "bar")).toBe(toComparableQueryJson(savedQuery, "bar"));
  });

  test("a duplicated filter no longer matches the saved query (ENG-7056)", () => {
    const form = formFrom(savedQuery);
    const edited = { ...form, filters: duplicateFilterNode(form.filters, form.filters[0].id) };

    expect(toBuilderQueryJson(edited, "bar")).not.toBe(toComparableQueryJson(savedQuery, "bar"));
  });

  test("no query compares as the empty form", () => {
    expect(toComparableQueryJson(undefined, "bar")).toBe(
      toBuilderQueryJson(EMPTY_CHART_BUILDER_STATE, "bar")
    );
  });
});

describe("toAdoptedQueryJson", () => {
  const groupedByDay: TChartQuery = {
    measures: ["FeedbackRecords.count"],
    timeDimensions: [
      { dimension: "FeedbackRecords.collectedAt", granularity: "day", dateRange: "last 30 days" },
    ],
  };

  test("a pie chart's automatic granularity drop is not an edit", () => {
    const form = formFrom(groupedByDay);
    const stripped = {
      ...form,
      timeDimension: { dimension: "FeedbackRecords.collectedAt", dateRange: "last 30 days" },
    };

    expect(toBuilderQueryJson(stripped, "pie")).toBe(toAdoptedQueryJson(groupedByDay, "pie"));
  });

  test("a chart that groups by time keeps its granularity", () => {
    expect(toAdoptedQueryJson(groupedByDay, "bar")).toBe(toComparableQueryJson(groupedByDay, "bar"));
  });

  test("a genuine filter edit still differs on a pie chart", () => {
    const form = formFrom(savedQuery);
    const edited = { ...form, filters: duplicateFilterNode(form.filters, form.filters[0].id) };

    expect(toBuilderQueryJson(edited, "pie")).not.toBe(toAdoptedQueryJson(savedQuery, "pie"));
  });
});
