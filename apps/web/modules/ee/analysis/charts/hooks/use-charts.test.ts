/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useCharts } from "./use-charts";

const WORKSPACE_ID = "clws000000000000000000001";
const DATASET_ID = "clds000000000000000000001";

const chart = (id: string) => ({
  id,
  workspaceId: WORKSPACE_ID,
  datasetId: DATASET_ID,
  name: `Chart ${id}`,
  type: "bar",
  query: { measures: ["FeedbackRecords.count"] },
  config: {},
  creator: null,
  dashboards: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
});

const page = (ids: string[], nextCursor: string | null) =>
  Response.json({ data: ids.map(chart), meta: { limit: 2, nextCursor } });

const wrapperFor = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseChartsTestWrapper";
  return Wrapper;
};

const render = (props: Partial<Parameters<typeof useCharts>[0]> = {}) =>
  renderHook(() => useCharts({ workspaceId: WORKSPACE_ID, limit: 2, ...props }), {
    wrapper: wrapperFor(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
  });

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

describe("useCharts", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("pages through the charts by cursor and flattens them into app charts", async () => {
    fetchMock.mockResolvedValueOnce(page(["c1", "c2"], "cursor-2")).mockResolvedValueOnce(page(["c3"], null));

    const { result } = render({ datasetId: DATASET_ID });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.charts).toHaveLength(3));
    expect(result.current.charts.map((item) => item.id)).toEqual(["c1", "c2", "c3"]);
    expect(result.current.charts[0].feedbackDirectoryId).toBe(DATASET_ID);
    expect(result.current.hasNextPage).toBe(false);
    const [first, second] = fetchMock.mock.calls.map(([url]) => new URL(url, "http://x").searchParams);
    expect(first.get("cursor")).toBeNull();
    expect(first.get("filter[datasetId][eq]")).toBe(DATASET_ID);
    expect(second.get("cursor")).toBe("cursor-2");
  });

  test("fetches nothing while disabled", async () => {
    const { result } = render({ enabled: false });

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.charts).toEqual([]);
  });

  test("exposes the error when the list is refused", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ status: 403, detail: "No", code: "dashboards_plan_required" }, { status: 403 })
    );

    const { result } = render();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 403, code: "dashboards_plan_required" });
    expect(result.current.charts).toEqual([]);
  });
});
