import { describe, expect, test } from "vitest";
import { createListState, describeCount, listReducer, resultKey } from "./state";
import type { ListPage, ShowResponsesData, ViewRow } from "./types";

const row = (id: string): ViewRow => ({
  id,
  createdAt: "2026-03-01T10:00:00.000Z",
  finished: true,
  language: null,
  tags: [],
  cells: {},
});
const column = (id: string, position: number) => ({ id, label: id, type: "openText", position });

const data: ShowResponsesData = {
  survey: { id: "sv1", name: "Survey" },
  query: { workspaceId: "ws1", surveyId: "sv1", limit: 20, sortBy: "-createdAt" },
  columns: [column("q1", 1)],
  rows: [row("a"), row("b")],
  nextCursor: "c1",
  total: { count: 5, relation: "eq" },
};
const page = (rows: ViewRow[], nextCursor: string | null, extra: Partial<ListPage> = {}): ListPage => ({
  rows,
  columns: [],
  nextCursor,
  ...extra,
});

describe("listReducer", () => {
  test("load more appends rows, advances the cursor and keeps the total when the page has none", () => {
    let state = listReducer(createListState(data), { type: "moreStart" });
    expect(state.phase).toBe("loadingMore");
    state = listReducer(state, {
      type: "moreDone",
      page: page([row("b"), row("c")], null, { columns: [column("q2", 2)] }),
    });
    expect(state.rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(state.nextCursor).toBeNull();
    expect(state.total).toEqual({ count: 5, relation: "eq" });
    expect(state.columns.map((c) => c.id)).toEqual(["q1", "q2"]);
    expect(state.phase).toBe("idle");
  });

  test("a refresh replaces rows and total but never drops a column", () => {
    const state = listReducer(createListState(data), {
      type: "refreshDone",
      page: page([row("z")], null, { total: { count: 1, relation: "eq" } }),
    });
    expect(state.rows.map((r) => r.id)).toEqual(["z"]);
    expect(state.total).toEqual({ count: 1, relation: "eq" });
    expect(state.columns.map((c) => c.id)).toEqual(["q1"]);
  });

  test("a failed page keeps the rows; a failed refresh clears rows that belong to the old filters", () => {
    const moreFailed = listReducer(listReducer(createListState(data), { type: "moreStart" }), {
      type: "moreFailed",
      message: "Timed out",
    });
    expect(moreFailed.rows).toHaveLength(2);
    expect(moreFailed.error).toBe("Timed out");
    expect(moreFailed.nextCursor).toBe("c1");

    const refreshFailed = listReducer(createListState(data), { type: "refreshFailed", message: "Nope" });
    expect(refreshFailed.rows).toEqual([]);
    expect(refreshFailed.nextCursor).toBeNull();
    expect(refreshFailed.error).toBe("Nope");
  });

  test("starting a request clears the previous error", () => {
    const failed = listReducer(createListState(data), { type: "moreFailed", message: "x" });
    expect(listReducer(failed, { type: "refreshStart" }).error).toBeUndefined();
  });
});

describe("describeCount", () => {
  const format = (n: number) => String(n);

  test("says how many of the total are on screen", () => {
    expect(describeCount(20, { count: 134, relation: "eq" }, format)).toBe("20 of 134 responses");
    expect(describeCount(134, { count: 134, relation: "eq" }, format)).toBe("134 responses");
    expect(describeCount(1, { count: 1, relation: "eq" }, format)).toBe("1 response");
    expect(describeCount(0, { count: 0, relation: "eq" }, format)).toBe("0 responses");
  });

  test("marks a capped total as a lower bound and copes with no total", () => {
    expect(describeCount(50, { count: 1000, relation: "gte" }, format)).toBe("50 of 1000+ responses");
    expect(describeCount(7, undefined, format)).toBe("7 responses");
  });
});

describe("resultKey", () => {
  test("differs when the query or first page differs", () => {
    const other = { ...data, query: { ...data.query, finished: true } };
    expect(resultKey(data)).not.toBe(resultKey(other));
    expect(resultKey(data)).toBe(resultKey({ ...data }));
  });
});
