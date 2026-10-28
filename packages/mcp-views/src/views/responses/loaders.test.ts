import { describe, expect, test, vi } from "vitest";
import { defaultFilters } from "./filters";
import {
  type CallTool,
  createLatestGate,
  loadListPage,
  loadMoreList,
  loadResponseDetail,
  refreshList,
} from "./loaders";
import type { ListQuery, RawToolResult } from "./types";

const query: ListQuery = { workspaceId: "ws1", surveyId: "sv1", limit: 20, sortBy: "-createdAt" };
const filters = defaultFilters("-createdAt");

const row = (id: string) => ({
  id,
  createdAt: "2026-03-01T10:00:00.000Z",
  finished: true,
  language: "en",
  tags: [],
  answers: [{ position: 1, elementId: "q1", elementLabel: "Why?", elementType: "openText", valueText: "A" }],
});
const listResult = (ids: string[], nextCursor: string | null = null): RawToolResult => ({
  structuredContent: {
    data: ids.map(row),
    meta: { nextCursor, totalCount: ids.length, totalCountRelation: "eq" },
  },
});
const toolError = (detail: string): RawToolResult => ({
  isError: true,
  structuredContent: { error: { status: 403, detail } },
});

const resolving = (result: RawToolResult): CallTool => vi.fn(() => Promise.resolve(result));

describe("loadListPage", () => {
  test("calls list_responses with the filters and reads the page", async () => {
    const callTool = resolving(listResult(["r1"], "next"));
    const page = await loadListPage(callTool, query, filters, "UTC", "cursor-1");
    const [params] = vi.mocked(callTool).mock.calls[0];
    expect(params.name).toBe("list_responses");
    expect(params.arguments).toMatchObject({ surveyId: "sv1", cursor: "cursor-1", includeTotalCount: true });
    expect(page.ok && page.value.rows.map((r) => r.id)).toEqual(["r1"]);
    expect(page.ok && page.value.nextCursor).toBe("next");
  });

  test("turns a tool error into a message", async () => {
    expect(await loadListPage(resolving(toolError("No access.")), query, filters, "UTC")).toEqual({
      ok: false,
      message: "No access.",
    });
  });

  test("turns a thrown error into a message, with a fallback for one that has none", async () => {
    const boom: CallTool = () => Promise.reject(new Error("Host went away"));
    expect(await loadListPage(boom, query, filters, "UTC")).toEqual({ ok: false, message: "Host went away" });
    const bare: CallTool = () => Promise.reject(new Error(""));
    expect(await loadListPage(bare, query, filters, "UTC")).toEqual({
      ok: false,
      message: "The request failed.",
    });
  });
});

describe("refreshList and loadMoreList", () => {
  test("a refresh settles as refreshDone, or refreshFailed on an error", async () => {
    const gate = createLatestGate();
    expect(await refreshList(gate, resolving(listResult(["r1"])), query, filters, "UTC")).toMatchObject({
      type: "refreshDone",
    });
    expect(await refreshList(gate, resolving(toolError("Nope")), query, filters, "UTC")).toEqual({
      type: "refreshFailed",
      message: "Nope",
    });
  });

  test("loading more settles as moreDone, or moreFailed when the call throws", async () => {
    const gate = createLatestGate();
    expect(await loadMoreList(gate, resolving(listResult(["r2"])), query, filters, "UTC", "c")).toMatchObject(
      {
        type: "moreDone",
      }
    );
    const boom: CallTool = () => Promise.reject(new Error("Timed out"));
    expect(await loadMoreList(gate, boom, query, filters, "UTC", "c")).toEqual({
      type: "moreFailed",
      message: "Timed out",
    });
  });

  test("drops the answer of a request that a newer one superseded", async () => {
    const gate = createLatestGate();
    let release: (result: RawToolResult) => void = () => undefined;
    const slow: CallTool = () => new Promise((resolve) => (release = resolve));

    const stale = refreshList(gate, slow, query, filters, "UTC");
    const fresh = await refreshList(gate, resolving(listResult(["new"])), query, filters, "UTC");
    release(listResult(["old"]));

    expect(fresh).toMatchObject({ type: "refreshDone" });
    expect(await stale).toBeUndefined();
  });
});

describe("loadResponseDetail", () => {
  const detail = { structuredContent: { data: { ...row("r1"), answers: row("r1").answers } } };

  test("calls get_response with the id and reads the detail", async () => {
    const callTool = resolving(detail);
    const parsed = await loadResponseDetail(callTool, "r1");
    expect(callTool).toHaveBeenCalledWith({ name: "get_response", arguments: { responseId: "r1" } });
    expect(parsed.ok && parsed.value.answers[0]?.lines).toEqual(["A"]);
  });

  test("reports a tool error and a thrown error", async () => {
    expect(await loadResponseDetail(resolving(toolError("Gone")), "r1")).toEqual({
      ok: false,
      message: "Gone",
    });
    const boom: CallTool = () => Promise.reject(new Error("Offline"));
    expect(await loadResponseDetail(boom, "r1")).toEqual({ ok: false, message: "Offline" });
  });
});
