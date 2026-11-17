/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAuthorizedMcpClients } from "./use-authorized-mcp-clients";
import { useRevokeMcpGrant } from "./use-revoke-mcp-grant";

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "useRevokeMcpGrantTestWrapper";
  return Wrapper;
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

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

  test("revokes through the grant route by client id, and the shown list drops the client", async () => {
    const lists = [
      { clients: [{ clientId: "client/a" }, { clientId: "client_b" }] },
      { clients: [{ clientId: "client_b" }] },
    ];
    vi.mocked(global.fetch).mockImplementation(async (_url, init) =>
      init?.method === "DELETE"
        ? json({ data: { clientId: "client/a" } })
        : json({ data: { isDashboardViewer: false, ...(lists.shift() ?? { clients: [] }) } })
    );
    const queryClient = newQueryClient();

    const { result } = renderHook(() => ({ list: useAuthorizedMcpClients(), revoke: useRevokeMcpGrant() }), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.list.data?.clients).toHaveLength(2));
    result.current.revoke.mutate("client/a");

    await waitFor(() => expect(result.current.list.data?.clients).toEqual([{ clientId: "client_b" }]));
    const revoked = vi.mocked(global.fetch).mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(revoked?.[0]).toBe("/api/internal/mcp-grants/client%2Fa");
  });

  // The client gives up after 15 s, but a Revoke waiting behind a reconciling pass can still commit:
  // the list is read again after a failure too, so it shows what the server holds.
  test("refreshes the shown list when the revoke fails, which the server may still have committed", async () => {
    const lists = [{ clients: [{ clientId: "client/a" }] }, { clients: [] }];
    vi.mocked(global.fetch).mockImplementation(async (_url, init) =>
      init?.method === "DELETE"
        ? new Response(JSON.stringify({ title: "Error", status: 500, detail: "Error", code: "internal" }), {
            status: 500,
            headers: { "Content-Type": "application/problem+json" },
          })
        : json({ data: { isDashboardViewer: false, ...(lists.shift() ?? { clients: [] }) } })
    );
    const queryClient = newQueryClient();

    const { result } = renderHook(() => ({ list: useAuthorizedMcpClients(), revoke: useRevokeMcpGrant() }), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.list.data?.clients).toHaveLength(1));
    result.current.revoke.mutate("client/a");

    await waitFor(() => expect(result.current.revoke.isError).toBe(true));
    await waitFor(() => expect(result.current.list.data?.clients).toEqual([]));
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

    const { result } = renderHook(() => useRevokeMcpGrant(), { wrapper: wrapper(queryClient) });
    result.current.mutate("client_a");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 403 });
  });
});
