/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useWorkflows } from "./use-workflows";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseWorkflowsTestWrapper";
  return Wrapper;
}

const listResponse = (data: { id: string; name: string }[], nextCursor: string | null): Response =>
  new Response(JSON.stringify({ data, meta: { limit: 12, nextCursor } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useWorkflows", () => {
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
      .mockResolvedValueOnce(listResponse([{ id: "wf_1", name: "Workflow 1" }], "cursor_1"))
      .mockResolvedValueOnce(listResponse([{ id: "wf_2", name: "Workflow 2" }], null));

    const { result } = renderHook(() => useWorkflows({ workspaceId: "ws_1", limit: 12, nameContains: "" }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.workflows).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.workflows).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v3/workflows?workspaceId=ws_1&limit=12&cursor=cursor_1",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("hides load-more when the first page has no next cursor", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(listResponse([{ id: "wf_1", name: "Workflow 1" }], null));

    const { result } = renderHook(() => useWorkflows({ workspaceId: "ws_1", limit: 12, nameContains: "" }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  test("a new search term refetches from page 1 with the nameContains filter", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(listResponse([{ id: "wf_1", name: "Workflow 1" }], null))
      .mockResolvedValueOnce(listResponse([{ id: "wf_2", name: "Onboarding" }], null));

    const { result, rerender } = renderHook(
      ({ nameContains }: { nameContains: string }) =>
        useWorkflows({ workspaceId: "ws_1", limit: 12, nameContains }),
      { initialProps: { nameContains: "" }, wrapper: createWrapper(newQueryClient()) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.workflows[0]?.name).toBe("Workflow 1");

    rerender({ nameContains: "onboarding" });

    await waitFor(() => expect(result.current.workflows[0]?.name).toBe("Onboarding"));
    // Second fetch starts a fresh page-1 query (no cursor) carrying the name filter.
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v3/workflows?workspaceId=ws_1&limit=12&filter%5Bname%5D%5Bcontains%5D=onboarding",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("surfaces the error state when the request fails", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 500, detail: "boom", code: "internal_server_error" }), {
        status: 500,
        headers: { "Content-Type": "application/problem+json" },
      })
    );

    const { result } = renderHook(() => useWorkflows({ workspaceId: "ws_1", limit: 12, nameContains: "" }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.workflows).toHaveLength(0);
  });
});
