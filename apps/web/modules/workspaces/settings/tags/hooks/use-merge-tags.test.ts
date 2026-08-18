/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { tagKeys } from "../lib/query";
import { useMergeTags } from "./use-merge-tags";

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "useMergeTagsTestWrapper";
  return Wrapper;
};

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });

describe("useMergeTags", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("merges through the merge sub-route, then invalidates exactly this workspace's tag list", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "cltt1234567890123456789012" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const queryClient = newQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useMergeTags("ws_1"), { wrapper: wrapper(queryClient) });
    result.current.mutate({ tagId: "cltt1234567890123456789012", newTagId: "clyy1234567890123456789012" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe("/api/v3/tags/cltt1234567890123456789012/merge");
    expect(vi.mocked(global.fetch).mock.calls[0][1]).toMatchObject({ method: "POST" });
    // The exact tuple matters: a key that does not match `useTags` leaves the table showing stale rows,
    // which is the whole reason this replaced `router.refresh()`.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tagKeys.list("ws_1") });
  });

  test("surfaces a rejected request instead of reporting success", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ title: "Forbidden", status: 403, detail: "not yours", code: "forbidden" }),
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      )
    );
    const queryClient = newQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useMergeTags("ws_1"), { wrapper: wrapper(queryClient) });

    await expect(
      result.current.mutateAsync({
        tagId: "cltt1234567890123456789012",
        newTagId: "clyy1234567890123456789012",
      })
    ).rejects.toThrow("not yours");
    expect(invalidate).not.toHaveBeenCalled();
  });
});
