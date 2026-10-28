/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useDashboard } from "./use-dashboard";

const DASHBOARD_ID = "cldb000000000000000000001";

const wrapperFor = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseDashboardTestWrapper";
  return Wrapper;
};

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

describe("useDashboard", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads the dashboard under its detail key, so a write to it can invalidate exactly that", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        data: {
          id: DASHBOARD_ID,
          workspaceId: "clws000000000000000000001",
          name: "Matchday",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-03T10:00:00.123Z",
          widgets: [],
        },
      })
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useDashboard(DASHBOARD_ID), { wrapper: wrapperFor(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.queryKey).toEqual(["dashboards", "detail", DASHBOARD_ID]);
    expect(result.current.data).toMatchObject({ id: DASHBOARD_ID, updatedAt: "2026-01-03T10:00:00.123Z" });
    expect(queryClient.getQueryData(result.current.queryKey)).toEqual(result.current.data);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/v3/dashboards/${DASHBOARD_ID}`);
  });
});
