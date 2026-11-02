/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useDashboards } from "./use-dashboards";

const WORKSPACE_ID = "clws000000000000000000001";

const item = (id: string) => ({
  id,
  name: `Dashboard ${id}`,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
});

const page = (ids: string[], nextCursor: string | null) =>
  Response.json({ data: ids.map(item), meta: { limit: 2, nextCursor } });

const wrapperFor = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseDashboardsTestWrapper";
  return Wrapper;
};

const render = (props: Partial<Parameters<typeof useDashboards>[0]> = {}) =>
  renderHook(() => useDashboards({ workspaceId: WORKSPACE_ID, limit: 2, ...props }), {
    wrapper: wrapperFor(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
  });

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

describe("useDashboards", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("loads the next page from the last page's cursor and flattens the pages into one list", async () => {
    fetchMock.mockResolvedValueOnce(page(["d1", "d2"], "cursor-2")).mockResolvedValueOnce(page(["d3"], null));

    const { result } = render({ nameContains: "match" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.dashboards.map((dashboard) => dashboard.id)).toEqual(["d1", "d2"]);
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.dashboards).toHaveLength(3));
    expect(result.current.dashboards.map((dashboard) => dashboard.id)).toEqual(["d1", "d2", "d3"]);
    expect(result.current.hasNextPage).toBe(false);
    const [firstUrl, secondUrl] = fetchMock.mock.calls.map(([url]) => new URL(url, "http://x").searchParams);
    expect(firstUrl.get("cursor")).toBeNull();
    expect(firstUrl.get("filter[name][contains]")).toBe("match");
    expect(secondUrl.get("cursor")).toBe("cursor-2");
    expect(secondUrl.get("filter[name][contains]")).toBe("match");
  });

  test("fetches nothing while disabled", async () => {
    const { result } = render({ enabled: false });

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.dashboards).toEqual([]);
  });

  test("exposes the list's query key, including its filters, for invalidation", () => {
    fetchMock.mockResolvedValue(page([], null));

    const { result } = render({ chartId: "c1" });

    expect(result.current.queryKey).toEqual([
      "dashboards",
      "list",
      { workspaceId: WORKSPACE_ID, limit: 2, chartId: "c1" },
    ]);
  });
});
