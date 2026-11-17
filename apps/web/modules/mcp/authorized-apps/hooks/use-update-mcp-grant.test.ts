/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { isStaleMcpGrantEditError } from "../lib/edit-grant";
import { useAuthorizedMcpClients } from "./use-authorized-mcp-clients";
import { useUpdateMcpGrant } from "./use-update-mcp-grant";

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

  // The client gives up after 15 s; the server, waiting behind a reconciling pass, can still commit.
  test("refreshes the shown list when the save never answers, which the server may still have committed", async () => {
    let listReads = 0;
    vi.mocked(global.fetch).mockImplementation(async (_url, init) => {
      if (init?.method === "PATCH") throw new TypeError("Failed to fetch");
      listReads += 1;
      return json({ data: { isDashboardViewer: false, clients: [{ clientId: "client_a" }] } });
    });
    const queryClient = newQueryClient();

    const { result } = renderHook(() => ({ list: useAuthorizedMcpClients(), update: useUpdateMcpGrant() }), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.list.data?.clients).toHaveLength(1));
    result.current.update.mutate({
      clientId: "client_a",
      grant: { permissions: { surveys: "read" } },
      expectedUpdatedAt: OPENED_AT,
    });

    await waitFor(() => expect(result.current.update.isError).toBe(true));
    await waitFor(() => expect(listReads).toBe(2));
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
    expect(isStaleMcpGrantEditError(result.current.update.error)).toBe(true);
    await waitFor(() =>
      expect(result.current.list.data?.clients).toEqual([
        { clientId: "client_a", permissions: { surveys: "read" } },
      ])
    );
  });

  // The hook refreshes the shown list whenever a save fails: a refusal means Edit opened on something
  // since changed, and a failure may be a save the server still committed after the client gave up (15 s).
  // Edit keeps its draft and the version it opened across the refetch, so a retry stays possible.
  test.each([
    ["a 409, the grant changed elsewhere", 409, "mcp_grant_changed"],
    ["a 422, the client's scopes narrowed", 422, "mcp_grant_beyond_scopes"],
    ["a 500, the save failed", 500, "mcp_grant_not_saved"],
  ])("on %s, refreshes the list", async (_case, status, code) => {
    let listReads = 0;
    vi.mocked(global.fetch).mockImplementation(async (_url, init) => {
      if (init?.method === "PATCH") return problem(status, code, "Refused");
      listReads += 1;
      return json({ data: { isDashboardViewer: false, clients: [{ clientId: "client_a" }] } });
    });
    const queryClient = newQueryClient();

    const { result } = renderHook(() => ({ list: useAuthorizedMcpClients(), update: useUpdateMcpGrant() }), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.list.data?.clients).toHaveLength(1));
    expect(listReads).toBe(1);
    result.current.update.mutate({
      clientId: "client_a",
      grant: { permissions: { surveys: "read" } },
      expectedUpdatedAt: OPENED_AT,
    });

    await waitFor(() => expect(result.current.update.isError).toBe(true));
    expect(result.current.update.error).toMatchObject({ status });
    await waitFor(() => expect(listReads).toBe(2));
  });
});
