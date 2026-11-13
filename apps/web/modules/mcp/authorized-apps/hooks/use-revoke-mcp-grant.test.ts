/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { authorizedMcpClientKeys } from "../lib/query";
import { useRevokeMcpGrant } from "./use-revoke-mcp-grant";

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "useRevokeMcpGrantTestWrapper";
  return Wrapper;
};

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });

describe("useRevokeMcpGrant", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("revokes through the grant route by client id, then invalidates the client list", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { clientId: "client/a" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const queryClient = newQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRevokeMcpGrant(), { wrapper: wrapper(queryClient) });
    result.current.mutate("client/a");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("/api/internal/mcp-grants/client%2Fa");
    expect(init).toMatchObject({ method: "DELETE" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: authorizedMcpClientKeys.list() });
  });

  test("surfaces a refused revoke instead of reporting success", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ title: "Forbidden", status: 403, detail: "Forbidden", code: "forbidden" }),
        {
          status: 403,
          headers: { "Content-Type": "application/problem+json" },
        }
      )
    );
    const queryClient = newQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRevokeMcpGrant(), { wrapper: wrapper(queryClient) });
    result.current.mutate("client_a");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
