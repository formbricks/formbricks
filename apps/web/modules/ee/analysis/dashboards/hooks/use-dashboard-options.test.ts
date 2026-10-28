/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DASHBOARD_OPTIONS_MAX_PAGES, useDashboardOptions } from "./use-dashboard-options";

const WORKSPACE_ID = "clws000000000000000000001";

let wrapper: (props: Readonly<{ children: ReactNode }>) => ReturnType<typeof createElement>;

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

const dashboard = (id: string) => ({
  id,
  workspaceId: WORKSPACE_ID,
  name: `Board ${id}`,
  creator: null,
  widgetCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const page = (ids: string[], nextCursor: string | null) =>
  Response.json({ data: ids.map(dashboard), meta: { limit: 250, nextCursor } });

const cursorOf = (url: string) => new URL(url, "http://localhost").searchParams.get("cursor");

describe("useDashboardOptions", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("follows every page, so an older dashboard is still offered", async () => {
    fetchMock.mockResolvedValueOnce(page(["a", "b"], "cursor_1")).mockResolvedValueOnce(page(["c"], null));

    const { result } = renderHook(() => useDashboardOptions({ workspaceId: WORKSPACE_ID, enabled: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { id: "a", name: "Board a" },
      { id: "b", name: "Board b" },
      { id: "c", name: "Board c" },
    ]);
    expect(fetchMock.mock.calls.map(([url]) => cursorOf(url))).toEqual([null, "cursor_1"]);
  });

  test("stops at the page ceiling even if the cursor never runs out", async () => {
    fetchMock.mockImplementation(async () => page(["x"], "again"));

    const { result } = renderHook(() => useDashboardOptions({ workspaceId: WORKSPACE_ID, enabled: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(DASHBOARD_OPTIONS_MAX_PAGES);
  });

  test("fetches nothing until the picker opens", () => {
    renderHook(() => useDashboardOptions({ workspaceId: WORKSPACE_ID, enabled: false }), { wrapper });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
