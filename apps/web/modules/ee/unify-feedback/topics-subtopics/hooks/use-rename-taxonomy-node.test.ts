/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type TTaxonomyScopeSelection, taxonomyKeys } from "../lib/query";
import { useRenameTaxonomyNode } from "./use-rename-taxonomy-node";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseRenameTaxonomyNodeTestWrapper";
  return Wrapper;
}

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });

const scope: TTaxonomyScopeSelection = {
  directoryId: "d",
  sourceType: "survey",
  sourceId: "",
  fieldId: "q1",
};

describe("useRenameTaxonomyNode", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("PATCHes the node label and invalidates state on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "n", label: "Renamed" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRenameTaxonomyNode({ workspaceId: "w", scope }), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ nodeId: "n", label: "Renamed" });
    });

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "/api/v3/unify-feedback/taxonomy/nodes/n",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taxonomyKeys.state("w", scope) });
  });

  test("throws when no scope is selected", async () => {
    const { result } = renderHook(() => useRenameTaxonomyNode({ workspaceId: "w", scope: null }), {
      wrapper: createWrapper(createQueryClient()),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ nodeId: "n", label: "x" });
      })
    ).rejects.toThrow("scope is required");
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });
});
