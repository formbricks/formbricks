import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import { flattenSurveyPages, removeSurveyFromInfiniteData } from "./query";
import { TSurveyListPage } from "./v3-surveys-client";

const surveyA = {
  id: "survey_a",
  name: "Survey A",
  workspaceId: "env_1",
  type: "link" as const,
  status: "draft" as const,
  createdAt: new Date("2026-04-15T10:00:00.000Z"),
  updatedAt: new Date("2026-04-15T10:00:00.000Z"),
  responseCount: 0,
  creator: { name: "Alice" },
  singleUse: null,
};

const surveyB = {
  ...surveyA,
  id: "survey_b",
  name: "Survey B",
};

const baseData: InfiniteData<TSurveyListPage> = {
  pages: [
    {
      data: [surveyA],
      meta: {
        limit: 20,
        nextCursor: "cursor-1",
        totalCount: 2,
      },
    },
    {
      data: [surveyB],
      meta: {
        limit: 20,
        nextCursor: null,
        totalCount: 2,
      },
    },
  ],
  pageParams: [null, "cursor-1"],
};

describe("flattenSurveyPages", () => {
  test("flattens every fetched page", () => {
    expect(flattenSurveyPages(baseData)).toEqual([surveyA, surveyB]);
  });
});

describe("removeSurveyFromInfiniteData", () => {
  test("removes the survey from cached pages and decrements each page total", () => {
    const nextData = removeSurveyFromInfiniteData(baseData, "survey_a");

    expect(nextData?.pages[0]?.data).toEqual([]);
    expect(nextData?.pages[1]?.data).toEqual([surveyB]);
    expect(nextData?.pages[0]?.meta.totalCount).toBe(1);
    expect(nextData?.pages[1]?.meta.totalCount).toBe(1);
  });

  test("returns the original cache when the survey is not present", () => {
    expect(removeSurveyFromInfiniteData(baseData, "missing_survey")).toBe(baseData);
  });

  test("preserves null totalCount for pages that skipped the count query", () => {
    const dataWithNullTotalCount: InfiniteData<TSurveyListPage> = {
      ...baseData,
      pages: [
        baseData.pages[0],
        {
          ...baseData.pages[1],
          meta: {
            ...baseData.pages[1].meta,
            totalCount: null,
          },
        },
      ],
    };

    const nextData = removeSurveyFromInfiniteData(dataWithNullTotalCount, "survey_a");

    expect(nextData?.pages[0]?.meta.totalCount).toBe(1);
    expect(nextData?.pages[1]?.meta.totalCount).toBeNull();
  });
});
