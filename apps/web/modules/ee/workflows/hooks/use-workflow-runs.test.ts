/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useWorkflowRuns } from "./use-workflow-runs";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseWorkflowRunsTestWrapper";
  return Wrapper;
}

const listResponse = (data: { id: string; workflowName: string }[], nextCursor: string | null): Response =>
  new Response(JSON.stringify({ data, meta: { limit: 20, nextCursor } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useWorkflowRuns", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches the initial page and appends the next cursor page on load-more", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(listResponse([{ id: "run_1", workflowName: "WF" }], "cursor_1"))
      .mockResolvedValueOnce(listResponse([{ id: "run_2", workflowName: "WF" }], null));

    const { result } = renderHook(() => useWorkflowRuns({ workspaceId: "ws_1", limit: 20 }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.runs).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v3/workflows/runs?workspaceId=ws_1&limit=20",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.runs).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v3/workflows/runs?workspaceId=ws_1&limit=20&cursor=cursor_1",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("hides load-more when the first page has no next cursor", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(listResponse([{ id: "run_1", workflowName: "WF" }], null));

    const { result } = renderHook(() => useWorkflowRuns({ workspaceId: "ws_1", limit: 20 }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  test("forwards the workflowId filter (per-workflow runs view)", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(listResponse([{ id: "run_1", workflowName: "WF" }], null));

    const { result } = renderHook(
      () => useWorkflowRuns({ workspaceId: "ws_1", limit: 20, filters: { workflowId: "wf_1" } }),
      { wrapper: createWrapper(newQueryClient()) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v3/workflows/runs?workspaceId=ws_1&limit=20&workflowId=wf_1",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("stays idle and issues no request when disabled", () => {
    const fetchMock = vi.mocked(global.fetch);

    const { result } = renderHook(() => useWorkflowRuns({ workspaceId: "ws_1", limit: 20, enabled: false }), {
      wrapper: createWrapper(newQueryClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.runs).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("surfaces the error state when the request fails", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 500, detail: "boom", code: "internal_server_error" }), {
        status: 500,
        headers: { "Content-Type": "application/problem+json" },
      })
    );

    const { result } = renderHook(() => useWorkflowRuns({ workspaceId: "ws_1", limit: 20 }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.runs).toHaveLength(0);
  });
});
