/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useChartData } from "./use-chart-data";

const CHART_ID = "clch000000000000000000001";

let wrapper: (props: Readonly<{ children: ReactNode }>) => ReturnType<typeof createElement>;

beforeEach(() => {
  // The hook's own retry policy is what is under test, so no default overrides it; no delay, so a retry
  // happens at once.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);
});

const dataResponse = () =>
  Response.json({
    data: {
      rows: [{ "FeedbackRecords.count": 7 }],
      optionLabels: {},
      fieldLabels: {},
      query: { measures: ["FeedbackRecords.count"] },
    },
  });

const problem = (status: number) =>
  Response.json(
    { status, detail: "Failed", code: status === 422 ? "unprocessable_content" : "internal" },
    { status }
  );

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

describe("useChartData", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads the chart for its own range when the dashboard sets none", async () => {
    fetchMock.mockResolvedValueOnce(dataResponse());

    const { result } = renderHook(() => useChartData({ chartId: CHART_ID, dateRange: null }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      rows: [{ "FeedbackRecords.count": 7 }],
      optionLabels: undefined,
      fieldLabels: undefined,
      query: { measures: ["FeedbackRecords.count"] },
    });
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/v3/charts/${CHART_ID}/data`);
  });

  test("reads the chart for the dashboard's range, replacing its own", async () => {
    fetchMock.mockResolvedValueOnce(dataResponse());

    const { result } = renderHook(
      () => useChartData({ chartId: CHART_ID, dateRange: { from: "2026-01-01", to: "2026-01-31" } }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/v3/charts/${CHART_ID}/data?from=2026-01-01&to=2026-01-31`);
  });

  test("shows a 4xx at once, without retrying", async () => {
    fetchMock.mockResolvedValue(problem(422));

    const { result } = renderHook(() => useChartData({ chartId: CHART_ID, dateRange: null }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 422 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("retries a server error once before showing it", async () => {
    fetchMock.mockResolvedValue(problem(502));

    const { result } = renderHook(() => useChartData({ chartId: CHART_ID, dateRange: null }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("recovers when the one retry succeeds", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(dataResponse());

    const { result } = renderHook(() => useChartData({ chartId: CHART_ID, dateRange: "last_7_days" }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/v3/charts/${CHART_ID}/data?dateRange=last_7_days`);
  });
});
