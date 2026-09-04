import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import { flattenSurveyPages, removeSurveyFromInfiniteData, updateSurveyInInfiniteData } from "./query";
import { TSurveyListPage } from "./v3-surveys-client";

const surveyA = {
  id: "survey_a",
  name: "Survey A",
  workspaceId: "env_1",
  type: "link" as const,
  status: "draft" as const,
  publishOn: null,
  archivedAt: null,
  createdAt: new Date("2026-04-15T10:00:00.000Z"),
  updatedAt: new Date("2026-04-15T10:00:00.000Z"),
  responseCount: 0,
  completedResponseCount: 0,
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
        workspaceSurveyCount: 4,
      },
    },
    {
      data: [surveyB],
      // Cursor requests are sent with includeTotalCount=false, so both counts come back null.
      meta: {
        limit: 20,
        nextCursor: null,
        totalCount: null,
        workspaceSurveyCount: null,
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
  test("drops the survey and decrements only the filtered total by default", () => {
    const nextData = removeSurveyFromInfiniteData(baseData, "survey_a");

    expect(nextData?.pages[0]?.data).toEqual([]);
    expect(nextData?.pages[1]?.data).toEqual([surveyB]);
    expect(nextData?.pages[0]?.meta.totalCount).toBe(1);
    // Archiving and restoring take a survey out of this view but leave it in the workspace.
    expect(nextData?.pages[0]?.meta.workspaceSurveyCount).toBe(4);
  });

  test("decrements the workspace count too when the survey leaves the workspace", () => {
    const nextData = removeSurveyFromInfiniteData(baseData, "survey_a", { removesFromWorkspace: true });

    expect(nextData?.pages[0]?.meta.totalCount).toBe(1);
    expect(nextData?.pages[0]?.meta.workspaceSurveyCount).toBe(3);
  });

  test("returns the original cache when the survey is not present", () => {
    expect(removeSurveyFromInfiniteData(baseData, "missing_survey")).toBe(baseData);
  });

  test("leaves the null counts of pages that skipped the count query alone", () => {
    const nextData = removeSurveyFromInfiniteData(baseData, "survey_a", { removesFromWorkspace: true });

    expect(nextData?.pages[1]?.meta.totalCount).toBeNull();
    expect(nextData?.pages[1]?.meta.workspaceSurveyCount).toBeNull();
  });
});

describe("updateSurveyInInfiniteData", () => {
  test("applies the patch to the matching survey and leaves others untouched", () => {
    const nextData = updateSurveyInInfiniteData(baseData, "survey_a", { status: "inProgress" });

    expect(nextData?.pages[0]?.data[0]?.status).toBe("inProgress");
    // survey_b lives on page 1 and must remain unchanged
    expect(nextData?.pages[1]?.data[0]).toEqual(surveyB);
  });

  test("returns the original reference when the surveyId is not present", () => {
    const result = updateSurveyInInfiniteData(baseData, "missing_survey", { status: "inProgress" });
    expect(result).toBe(baseData);
  });

  test("returns undefined when called with undefined data", () => {
    expect(updateSurveyInInfiniteData(undefined, "survey_a", { status: "inProgress" })).toBeUndefined();
  });

  test("does not mutate the original data object", () => {
    const originalPage0Survey = baseData.pages[0]?.data[0];
    updateSurveyInInfiniteData(baseData, "survey_a", { status: "completed" });
    // Original fixture must be unmodified
    expect(originalPage0Survey?.status).toBe("draft");
  });
});
