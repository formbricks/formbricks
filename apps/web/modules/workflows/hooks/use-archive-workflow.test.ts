/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TWorkflowListPage } from "../lib/api-client";
import { workflowKeys } from "../lib/query";
import { useArchiveWorkflow } from "./use-archive-workflow";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseArchiveWorkflowTestWrapper";
  return Wrapper;
}

const queryKey = workflowKeys.list({ workspaceId: "ws_1", limit: 12, nameContains: "" });

const seedData = (): { pages: TWorkflowListPage[]; pageParams: (string | null)[] } => ({
  pages: [
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: [{ id: "wf_1", name: "One" } as any, { id: "wf_2", name: "Two" } as any],
      meta: { limit: 12, nextCursor: null },
    },
  ],
  pageParams: [null],
});

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });

describe("useArchiveWorkflow", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("optimistically drops the archived workflow from the default list and invalidates on success", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(global.fetch).mockReturnValue(fetchPromise as Promise<Response>);

    const queryClient = newQueryClient();
    queryClient.setQueryData(queryKey, seedData());
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useArchiveWorkflow({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ workflowId: "wf_2" });

    await waitFor(() =>
      expect(
        queryClient.getQueryData<{ pages: TWorkflowListPage[] }>(queryKey)?.pages[0]?.data.map((w) => w.id)
      ).toEqual(["wf_1"])
    );

    resolveFetch?.(
      new Response(JSON.stringify({ data: { id: "wf_2", status: "archived" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: workflowKeys.lists() });
  });

  test("rolls the cache back when archive fails", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 422,
          detail: "Workflow is already archived.",
          code: "invalid_workflow_state",
        }),
        { status: 422, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    const queryClient = newQueryClient();
    queryClient.setQueryData(queryKey, seedData());

    const { result } = renderHook(() => useArchiveWorkflow({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ workflowId: "wf_2" });
      })
    ).rejects.toThrow("Workflow is already archived.");

    expect(
      queryClient.getQueryData<{ pages: TWorkflowListPage[] }>(queryKey)?.pages[0]?.data.map((w) => w.id)
    ).toEqual(["wf_1", "wf_2"]);
  });
});
