/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useDashboardViewerAccessMatch } from "./use-dashboard-viewer-access-match";

const DASHBOARD_ID = "cldb000000000000000000001";
const VIEWED_AS = "clus000000000000000000009";

let wrapper: (props: Readonly<{ children: ReactNode }>) => ReturnType<typeof createElement>;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

describe("useDashboardViewerAccessMatch", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("asks nothing for a reader who is unrestricted", () => {
    const { result } = renderHook(
      () => useDashboardViewerAccessMatch({ dashboardId: DASHBOARD_ID, status: "unrestricted" }),
      { wrapper }
    );
    expect(result.current.isUnmatched).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("is unmatched at once, without asking, when the dashboard read already said so", () => {
    const { result } = renderHook(
      () => useDashboardViewerAccessMatch({ dashboardId: DASHBOARD_ID, status: "unmatched" }),
      { wrapper }
    );
    expect(result.current.isUnmatched).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("turns a restricted read unmatched when no record matches, as the View as member", async () => {
    window.history.replaceState(null, "", `/?viewAs=${VIEWED_AS}`);
    fetchMock.mockResolvedValue(Response.json({ data: { status: "unmatched" } }));
    const { result } = renderHook(
      () => useDashboardViewerAccessMatch({ dashboardId: DASHBOARD_ID, status: "restricted" }),
      { wrapper }
    );
    expect(result.current.isUnmatched).toBe(false);
    await waitFor(() => expect(result.current.isUnmatched).toBe(true));
    expect(fetchMock.mock.calls[0][0]).toBe(
      `/api/internal/dashboards/${DASHBOARD_ID}/viewer-access?viewAs=${VIEWED_AS}`
    );
  });

  test("keeps the charts when a record matches", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: { status: "restricted" } }));
    const { result } = renderHook(
      () => useDashboardViewerAccessMatch({ dashboardId: DASHBOARD_ID, status: "restricted" }),
      { wrapper }
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.isUnmatched).toBe(false);
  });

  test("keeps the charts when the check fails", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const { result } = renderHook(
      () => useDashboardViewerAccessMatch({ dashboardId: DASHBOARD_ID, status: "restricted" }),
      { wrapper }
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.isUnmatched).toBe(false);
  });
});
