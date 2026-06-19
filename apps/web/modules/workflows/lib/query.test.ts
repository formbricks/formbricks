import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import type { TWorkflowListPage } from "./api-client";
import { flattenWorkflowPages, removeWorkflowFromInfiniteData, workflowKeys } from "./query";

const buildData = (): InfiniteData<TWorkflowListPage> => ({
  pages: [
    {
      data: [
        { id: "wf_1", name: "One" },
        { id: "wf_2", name: "Two" },
      ],
      meta: { limit: 12, nextCursor: "cursor_1" },
    },
    {
      data: [{ id: "wf_3", name: "Three" }],
      meta: { limit: 12, nextCursor: null },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any,
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
