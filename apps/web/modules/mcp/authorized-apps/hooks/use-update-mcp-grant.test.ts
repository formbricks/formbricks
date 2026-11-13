/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { authorizedMcpClientKeys } from "../lib/query";
import { useUpdateMcpGrant } from "./use-update-mcp-grant";

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "useUpdateMcpGrantTestWrapper";
  return Wrapper;
};

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });

describe("useUpdateMcpGrant", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("saves through the grant route, then invalidates the client list", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { clientId: "client/a", permissions: { surveys: "read" } } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const queryClient = newQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateMcpGrant(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ clientId: "client/a", permissions: { surveys: "read" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("/api/internal/mcp-grants/client%2Fa");
    expect(init).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ permissions: { surveys: "read" } }),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: authorizedMcpClientKeys.list() });
  });

  test("surfaces a refused save instead of reporting success", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          title: "Unprocessable Content",
          status: 422,
          detail: "This app didn't ask for that much access.",
          code: "mcp_grant_beyond_scopes",
        }),
        { status: 422, headers: { "Content-Type": "application/problem+json" } }
      )
    );
    const queryClient = newQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateMcpGrant(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ clientId: "client_a", permissions: { workflows: "write" } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
