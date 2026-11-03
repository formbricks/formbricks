/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useChartData } from "./use-chart-data";

const CHART_ID = "clch000000000000000000001";
const DASHBOARD_ID = "cldb000000000000000000001";
const FILTER_ID = "clfi000000000000000000001";
const DATA_PATH = `/api/v3/dashboards/${DASHBOARD_ID}/charts/${CHART_ID}/data`;
const NO_PICKS = {};
const read =
  (dateRange: Parameters<typeof useChartData>[0]["dateRange"], picks = NO_PICKS) =>
  () =>
    useChartData({ dashboardId: DASHBOARD_ID, chartId: CHART_ID, dateRange, picks });

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
      unfilterableFilters: [],
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

    const { result } = renderHook(read(null), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      rows: [{ "FeedbackRecords.count": 7 }],
      optionLabels: undefined,
      fieldLabels: undefined,
      query: { measures: ["FeedbackRecords.count"] },
      unfilterableFilters: [],
    });
    expect(fetchMock.mock.calls[0][0]).toBe(DATA_PATH);
  });

  test("reads the chart through its dashboard for the dashboard's range and the filter picks", async () => {
    fetchMock.mockResolvedValueOnce(dataResponse());

    const { result } = renderHook(
      read({ from: "2026-01-01", to: "2026-01-31" }, { [FILTER_ID]: ["Web", "App"] }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(decodeURIComponent(fetchMock.mock.calls[0][0])).toBe(
      `${DATA_PATH}?from=2026-01-01&to=2026-01-31&picks[${FILTER_ID}]=Web&picks[${FILTER_ID}]=App`
    );
  });

  test("shows a 4xx at once, without retrying", async () => {
    fetchMock.mockResolvedValue(problem(422));

    const { result } = renderHook(read(null), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 422 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("retries a server error once before showing it", async () => {
    fetchMock.mockResolvedValue(problem(502));

    const { result } = renderHook(read(null), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("waits out a brief 429 — every chart query slot taken — instead of showing it", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json(
          { status: 429, detail: "Busy", code: "too_many_requests" },
          { status: 429, headers: { "Retry-After": "1" } }
        )
      )
      .mockResolvedValueOnce(
        Response.json(
          { status: 429, detail: "Busy", code: "too_many_requests" },
          { status: 429, headers: { "Retry-After": "1" } }
        )
      )
      .mockResolvedValueOnce(dataResponse());

    const { result } = renderHook(read(null), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("recovers when the one retry succeeds", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(dataResponse());

    const { result } = renderHook(read("last_7_days"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(`${DATA_PATH}?dateRange=last_7_days`);
  });
});
