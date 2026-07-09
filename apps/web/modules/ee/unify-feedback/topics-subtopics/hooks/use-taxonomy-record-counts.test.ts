/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useTaxonomyRecordCounts } from "./use-taxonomy-record-counts";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseTaxonomyRecordCountsTestWrapper";
  return Wrapper;
}

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useTaxonomyRecordCounts", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches per-node record counts for the active run", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            counts: [
              { node_id: "node-1", record_count: 42 },
              { node_id: "node-2", record_count: 7 },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const { result } = renderHook(
      () => useTaxonomyRecordCounts({ workspaceId: "w", directoryId: "d", runId: "run-1" }),
      { wrapper: createWrapper(createQueryClient()) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { node_id: "node-1", record_count: 42 },
      { node_id: "node-2", record_count: 7 },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/unify-feedback/taxonomy/runs/run-1/record-counts?workspaceId=w&directoryId=d",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("stays idle (no fetch) when runId is null", () => {
    const fetchMock = vi.mocked(global.fetch);

    const { result } = renderHook(
      () => useTaxonomyRecordCounts({ workspaceId: "w", directoryId: "d", runId: null }),
      { wrapper: createWrapper(createQueryClient()) }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
