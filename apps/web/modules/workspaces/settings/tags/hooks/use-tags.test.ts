/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { tagKeys } from "../lib/query";
import { useTags } from "./use-tags";

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseTagsTestWrapper";
  return Wrapper;
};

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const tag = { id: "cltt1234567890123456789012", name: "Bug report", count: 3 };

describe("useTags", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("loads a workspace's tags and caches them under the shared list key", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: [tag] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const queryClient = newQueryClient();

    const { result } = renderHook(() => useTags("ws_1"), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([tag]);
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe("/api/v3/tags?workspaceId=ws_1");
    // Written under the same key the mutation hooks invalidate — otherwise a write never refreshes this.
    expect(queryClient.getQueryData(tagKeys.list("ws_1"))).toEqual([tag]);
  });

  test("reports a failure rather than rendering an empty table as if there were no tags", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ title: "Forbidden", status: 403, detail: "not yours", code: "forbidden" }),
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    const { result } = renderHook(() => useTags("ws_1"), { wrapper: wrapper(newQueryClient()) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
