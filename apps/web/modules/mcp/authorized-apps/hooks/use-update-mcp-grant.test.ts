/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAuthorizedMcpClients } from "./use-authorized-mcp-clients";
import { isMcpGrantChangedError, useUpdateMcpGrant } from "./use-update-mcp-grant";

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "useUpdateMcpGrantTestWrapper";
  return Wrapper;
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

const OPENED_AT = "2026-06-01T10:00:00.123Z";

const problem = (status: number, code: string, detail: string) =>
  new Response(JSON.stringify({ title: "Refused", status, detail, code }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

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

  test("saves through the grant route, and the shown list shows the saved grant", async () => {
    const lists = [
      { clients: [{ clientId: "client/a", permissions: { surveys: "write" } }] },
      { clients: [{ clientId: "client/a", permissions: { surveys: "read" } }] },
    ];
    vi.mocked(global.fetch).mockImplementation(async (_url, init) =>
      init?.method === "PATCH"
        ? json({ data: { clientId: "client/a", permissions: { surveys: "read" } } })
        : json({ data: { isDashboardViewer: false, ...(lists.shift() ?? { clients: [] }) } })
    );
    const queryClient = newQueryClient();

    const { result } = renderHook(() => ({ list: useAuthorizedMcpClients(), update: useUpdateMcpGrant() }), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.list.data?.clients).toHaveLength(1));
    result.current.update.mutate({
      clientId: "client/a",
      grant: { permissions: { surveys: "read" } },
      expectedUpdatedAt: OPENED_AT,
    });

    await waitFor(() =>
      expect(result.current.list.data?.clients).toEqual([
        { clientId: "client/a", permissions: { surveys: "read" } },
      ])
    );
    const saved = vi.mocked(global.fetch).mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(saved?.[0]).toBe("/api/internal/mcp-grants/client%2Fa");
    expect(saved?.[1]).toMatchObject({
      body: JSON.stringify({ permissions: { surveys: "read" }, expectedUpdatedAt: OPENED_AT }),
    });
  });

  // Saved from another tab since Edit opened: the save is refused, and the list shows what that tab saved.
  test("refreshes the shown list when the grant changed elsewhere, and says so", async () => {
    const lists = [
      { clients: [{ clientId: "client_a", permissions: { surveys: "write" } }] },
      { clients: [{ clientId: "client_a", permissions: { surveys: "read" } }] },
    ];
    vi.mocked(global.fetch).mockImplementation(async (_url, init) =>
      init?.method === "PATCH"
        ? problem(409, "mcp_grant_changed", "This MCP client's access changed elsewhere. Reload to see it.")
        : json({ data: { isDashboardViewer: false, ...(lists.shift() ?? { clients: [] }) } })
    );
    const queryClient = newQueryClient();

    const { result } = renderHook(() => ({ list: useAuthorizedMcpClients(), update: useUpdateMcpGrant() }), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.list.data?.clients).toHaveLength(1));
    result.current.update.mutate({
      clientId: "client_a",
      grant: { permissions: { surveys: "write", responses: "read" } },
      expectedUpdatedAt: OPENED_AT,
    });

    await waitFor(() => expect(result.current.update.isError).toBe(true));
    expect(isMcpGrantChangedError(result.current.update.error)).toBe(true);
    await waitFor(() =>
      expect(result.current.list.data?.clients).toEqual([
        { clientId: "client_a", permissions: { surveys: "read" } },
      ])
    );
  });

  test("surfaces a refused save instead of reporting success", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      problem(422, "mcp_grant_beyond_scopes", "This app didn't ask for that much access.")
    );
    const queryClient = newQueryClient();

    const { result } = renderHook(() => useUpdateMcpGrant(), { wrapper: wrapper(queryClient) });
    result.current.mutate({
      clientId: "client_a",
      grant: { permissions: { workflows: "write" } },
      expectedUpdatedAt: OPENED_AT,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 422 });
    // Only a change made elsewhere reads as one: another refusal keeps its own message.
    expect(isMcpGrantChangedError(result.current.error)).toBe(false);
  });
});
