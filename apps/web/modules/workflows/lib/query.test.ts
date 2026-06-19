import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import type { TWorkflowListItem } from "@formbricks/workflows";
import type { TWorkflowListPage } from "./api-client";
import { flattenWorkflowPages, removeWorkflowFromInfiniteData, workflowKeys } from "./query";

const workflowListItem = (id: string, name: string): TWorkflowListItem => ({
  id,
  workspaceId: "ws_1",
  name,
  description: null,
  status: "draft",
  triggerType: "response.completed",
  surveyId: "survey_1",
  createdBy: null,
  createdAt: "2026-06-11T09:30:00.000Z",
  updatedAt: "2026-06-11T09:30:00.000Z",
  lastRun: null,
});

const buildData = (): InfiniteData<TWorkflowListPage> => ({
  pages: [
    {
      data: [workflowListItem("wf_1", "One"), workflowListItem("wf_2", "Two")],
      meta: { limit: 12, nextCursor: "cursor_1" },
    },
    {
      data: [workflowListItem("wf_3", "Three")],
      meta: { limit: 12, nextCursor: null },
    },
  ],
  pageParams: [null, "cursor_1"],
});

describe("workflowKeys", () => {
  test("list key extends the lists key with the full input", () => {
    const input = { workspaceId: "ws_1", limit: 12, nameContains: "abc" };
    expect(workflowKeys.list(input)).toEqual(["workflows", "list", input]);
    expect(workflowKeys.lists()).toEqual(["workflows", "list"]);
  });

  test("a different search term produces a distinct query key", () => {
    const base = { workspaceId: "ws_1", limit: 12, nameContains: "" };
    expect(workflowKeys.list(base)).not.toEqual(workflowKeys.list({ ...base, nameContains: "abc" }));
  });
});

describe("flattenWorkflowPages", () => {
  test("flattens every page's data in order", () => {
    expect(flattenWorkflowPages(buildData()).map((w) => w.id)).toEqual(["wf_1", "wf_2", "wf_3"]);
  });

  test("returns an empty array when there is no data", () => {
    expect(flattenWorkflowPages(undefined)).toEqual([]);
  });
});

describe("removeWorkflowFromInfiniteData", () => {
  test("removes the matching workflow from its page", () => {
    const next = removeWorkflowFromInfiniteData(buildData(), "wf_2");
    expect(flattenWorkflowPages(next).map((w) => w.id)).toEqual(["wf_1", "wf_3"]);
  });

  test("returns the same reference when nothing matched", () => {
    const data = buildData();
    expect(removeWorkflowFromInfiniteData(data, "missing")).toBe(data);
  });

  test("returns undefined when there is no data", () => {
    expect(removeWorkflowFromInfiniteData(undefined, "wf_1")).toBeUndefined();
  });
});
