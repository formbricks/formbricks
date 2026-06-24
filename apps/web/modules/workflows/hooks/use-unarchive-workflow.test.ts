/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { workflowKeys } from "../lib/query";
import { useUnarchiveWorkflow } from "./use-unarchive-workflow";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseUnarchiveWorkflowTestWrapper";
  return Wrapper;
}

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });

describe("useUnarchiveWorkflow", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("posts to the unarchive endpoint and invalidates the lists on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "wf_1", status: "disabled" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const queryClient = newQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUnarchiveWorkflow(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ workflowId: "wf_1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v3/workflows/wf_1/unarchive",
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: workflowKeys.lists() });
  });
});
