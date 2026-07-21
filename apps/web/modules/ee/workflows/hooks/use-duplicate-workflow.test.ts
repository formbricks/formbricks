/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { workflowKeys } from "../lib/query";
import { useDuplicateWorkflow } from "./use-duplicate-workflow";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseDuplicateWorkflowTestWrapper";
  return Wrapper;
}

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });

describe("useDuplicateWorkflow", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("posts to the duplicate endpoint, returns the copy and invalidates list queries", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "wf_copy", name: "One (copy)", status: "draft" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    const queryClient = newQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDuplicateWorkflow(), { wrapper: createWrapper(queryClient) });

    let copy: { id: string } | undefined;
    await act(async () => {
      copy = await result.current.mutateAsync({ workflowId: "wf_1" });
    });

    expect(copy).toMatchObject({ id: "wf_copy" });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v3/workflows/wf_1/duplicate",
      expect.objectContaining({ method: "POST" })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: workflowKeys.lists() });
  });
});
