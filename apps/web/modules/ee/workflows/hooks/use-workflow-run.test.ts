/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useWorkflowRun } from "./use-workflow-run";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseWorkflowRunTestWrapper";
  return Wrapper;
}

const detailResponse = (id: string): Response =>
  new Response(JSON.stringify({ data: { id, logs: [], triggerPayload: {}, data: {} } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useWorkflowRun", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches the run detail by id and unwraps the data envelope", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(detailResponse("run_1"));

    const { result } = renderHook(() => useWorkflowRun({ runId: "run_1" }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("run_1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/workflows/runs/run_1",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("stays idle and issues no request when runId is null", async () => {
    const fetchMock = vi.mocked(global.fetch);

    const { result } = renderHook(() => useWorkflowRun({ runId: null }), {
      wrapper: createWrapper(newQueryClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("does not fetch while disabled even with a runId", async () => {
    const fetchMock = vi.mocked(global.fetch);

    renderHook(() => useWorkflowRun({ runId: "run_1", enabled: false }), {
      wrapper: createWrapper(newQueryClient()),
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("surfaces the error state when the request fails", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 403, detail: "forbidden", code: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/problem+json" },
      })
    );

    const { result } = renderHook(() => useWorkflowRun({ runId: "run_1" }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
