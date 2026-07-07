/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TaxonomyNode, TaxonomyRun } from "@/modules/hub/types";
import type { TTaxonomyStateResponse } from "../lib/api-client";
import { type TTaxonomyScopeSelection, taxonomyKeys } from "../lib/query";
import { useRemoveTaxonomyNode } from "./use-remove-taxonomy-node";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseRemoveTaxonomyNodeTestWrapper";
  return Wrapper;
}

const workspaceId = "w";
const scope: TTaxonomyScopeSelection = {
  directoryId: "d",
  sourceType: "survey",
  sourceId: "",
  fieldId: "q1",
};
const stateKey = taxonomyKeys.state(workspaceId, scope);

const topic = (id: string): TaxonomyNode => ({
  id,
  run_id: "run",
  node_type: "branch",
  label: id,
  level: 1,
  sort_order: 0,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
});

const seedState = (): TTaxonomyStateResponse => ({
  activeTree: {
    run: { id: "run" } as TaxonomyRun,
    root: {
      ...topic("root"),
      node_type: "root",
      level: 0,
      children: [topic("topic-1"), topic("topic-2")],
    },
  },
  runs: [],
  unavailable: false,
});

const rootChildIds = (queryClient: QueryClient): string[] | undefined =>
  queryClient
    .getQueryData<TTaxonomyStateResponse>(stateKey)
    ?.activeTree?.root?.children?.map((child) => child.id);

describe("useRemoveTaxonomyNode", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("optimistically removes the node and invalidates state on success", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(global.fetch).mockReturnValue(fetchPromise as Promise<Response>);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    queryClient.setQueryData(stateKey, seedState());
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRemoveTaxonomyNode({ workspaceId, scope }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ nodeId: "topic-1" });

    await waitFor(() => expect(rootChildIds(queryClient)).toEqual(["topic-2"]));

    resolveFetch?.(new Response(null, { status: 204 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: stateKey });
  });

  test("rolls the tree back when the soft-remove fails", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          title: "Bad Gateway",
          status: 502,
          detail: "hub down",
          code: "bad_gateway",
          requestId: "req_1",
        }),
        { status: 502, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    queryClient.setQueryData(stateKey, seedState());

    const { result } = renderHook(() => useRemoveTaxonomyNode({ workspaceId, scope }), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ nodeId: "topic-1" });
      })
    ).rejects.toThrow("hub down");

    expect(rootChildIds(queryClient)).toEqual(["topic-1", "topic-2"]);
  });
});
