/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useTaxonomyNodeRecords } from "./use-taxonomy-node-records";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseTaxonomyNodeRecordsTestWrapper";
  return Wrapper;
}

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useTaxonomyNodeRecords", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches a capped sample of records for the selected node", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "rec-1" }], meta: { limit: 100 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(
      () => useTaxonomyNodeRecords({ workspaceId: "w", directoryId: "d", nodeId: "n" }),
      { wrapper: createWrapper(createQueryClient()) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ records: [{ id: "rec-1" }], limit: 100 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/unify-feedback/taxonomy/nodes/n/records?workspaceId=w&directoryId=d&limit=100",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("stays idle (no fetch) when nodeId is null", () => {
    const fetchMock = vi.mocked(global.fetch);

    const { result } = renderHook(
      () => useTaxonomyNodeRecords({ workspaceId: "w", directoryId: "d", nodeId: null }),
      { wrapper: createWrapper(createQueryClient()) }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
