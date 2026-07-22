import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import type { TWorkflowListItem, TWorkflowRunListItem } from "@formbricks/workflows";
import type { TWorkflowListPage, TWorkflowRunListPage } from "./api-client";
import {
  flattenWorkflowPages,
  flattenWorkflowRunPages,
  removeWorkflowFromInfiniteData,
  workflowKeys,
  workflowRunKeys,
} from "./query";

const workflowListItem = (id: string, name: string): TWorkflowListItem => ({
  id,
  workspaceId: "ws_1",
  name,
  description: null,
  status: "draft",
  triggerType: "response.completed",
  surveyId: "survey_1",
  createdBy: null,
  creator: null,
  createdAt: "2026-06-11T09:30:00.000Z",
  updatedAt: "2026-06-11T09:30:00.000Z",
  lastRun: null,
  runCount: 0,
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

const workflowRunListItem = (id: string, workflowName: string): TWorkflowRunListItem => ({
  id,
  workflowId: "wf_1",
  workspaceId: "ws_1",
  workflowVersionId: "wfv_1",
  status: "completed",
  isDryRun: false,
  triggerType: "response.completed",
  surveyId: "survey_1",
  responseId: "resp_1",
  error: null,
  attempt: 0,
  createdAt: "2026-06-12T10:00:00.000Z",
  updatedAt: "2026-06-12T10:00:30.000Z",
  startedAt: "2026-06-12T10:00:10.000Z",
  finishedAt: "2026-06-12T10:00:30.000Z",
  workflowName,
});

const buildRunData = (): InfiniteData<TWorkflowRunListPage> => ({
  pages: [
    {
      data: [workflowRunListItem("run_1", "Notify team"), workflowRunListItem("run_2", "Notify team")],
      meta: { limit: 20, nextCursor: "cursor_1" },
    },
    {
      data: [workflowRunListItem("run_3", "Notify team")],
      meta: { limit: 20, nextCursor: null },
    },
  ],
  pageParams: [null, "cursor_1"],
});

describe("workflowRunKeys", () => {
  test("list key extends the lists key with the full input", () => {
    const input = { workspaceId: "ws_1", limit: 20, filters: { workflowId: "wf_1" } };
    expect(workflowRunKeys.list(input)).toEqual(["workflow-runs", "list", input]);
    expect(workflowRunKeys.lists()).toEqual(["workflow-runs", "list"]);
  });

  test("detail key extends the details key with the run id", () => {
    expect(workflowRunKeys.detail("run_1")).toEqual(["workflow-runs", "detail", "run_1"]);
    expect(workflowRunKeys.details()).toEqual(["workflow-runs", "detail"]);
  });

  test("a different filter set produces a distinct list key", () => {
    const base = { workspaceId: "ws_1", limit: 20 };
    expect(workflowRunKeys.list(base)).not.toEqual(
      workflowRunKeys.list({ ...base, filters: { workflowId: "wf_1" } })
    );
  });
});

describe("flattenWorkflowRunPages", () => {
  test("flattens every page's data in order", () => {
    expect(flattenWorkflowRunPages(buildRunData()).map((r) => r.id)).toEqual(["run_1", "run_2", "run_3"]);
  });

  test("returns an empty array when there is no data", () => {
    expect(flattenWorkflowRunPages(undefined)).toEqual([]);
  });
});
