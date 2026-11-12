/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useMcpConnections } from "./use-mcp-connections";

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "useMcpConnectionsTestWrapper";
  return Wrapper;
};

describe("useMcpConnections", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads the session user's connections from the internal route, uncached", async () => {
    const list = { isDashboardViewer: false, connections: [] };
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: list }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useMcpConnections(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(list);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("/api/internal/mcp-grants");
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
  });
});
