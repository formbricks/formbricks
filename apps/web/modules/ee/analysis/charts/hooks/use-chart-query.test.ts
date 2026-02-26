/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import { useChartQuery } from "./use-chart-query";

const mockExecuteQueryAction = vi.fn();
vi.mock("@/modules/ee/analysis/charts/actions", () => ({
  executeQueryAction: (...args: unknown[]) => mockExecuteQueryAction(...args),
}));

vi.mock("react-hot-toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: (result: unknown) =>
    (result as { serverError?: string })?.serverError ?? "Unknown error",
}));

const SAMPLE_QUERY: TChartQuery = {
  measures: ["FeedbackRecords.count"],
  dimensions: ["FeedbackRecords.sentiment"],
};

describe("useChartQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("initializes with null state and no loading", () => {
    const { result } = renderHook(() => useChartQuery("env-1"));

    expect(result.current.chartData).toBeNull();
    expect(result.current.query).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("initializes query from initialQuery parameter", () => {
    const { result } = renderHook(() => useChartQuery("env-1", SAMPLE_QUERY));

    expect(result.current.query).toEqual(SAMPLE_QUERY);
  });

  test("sets chartData and query on successful execution", async () => {
    const responseData = [{ "FeedbackRecords.sentiment": "positive", "FeedbackRecords.count": 42 }];
    mockExecuteQueryAction.mockResolvedValue({ data: responseData });

    const { result } = renderHook(() => useChartQuery("env-1"));

    let queryResult: unknown;
    await act(async () => {
      queryResult = await result.current.runQuery(SAMPLE_QUERY);
    });

    expect(result.current.chartData).toEqual(responseData);
    expect(result.current.query).toEqual(SAMPLE_QUERY);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(queryResult).toEqual({ query: SAMPLE_QUERY, data: responseData });
  });

  test("sets error on server error response", async () => {
    mockExecuteQueryAction.mockResolvedValue({ serverError: "Cube.js unavailable" });

    const { result } = renderHook(() => useChartQuery("env-1"));

    let queryResult: unknown;
    await act(async () => {
      queryResult = await result.current.runQuery(SAMPLE_QUERY);
    });

    expect(queryResult).toBeNull();
    expect(result.current.chartData).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
  });

  test("sets error when no data returned", async () => {
    mockExecuteQueryAction.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useChartQuery("env-1"));

    let queryResult: unknown;
    await act(async () => {
      queryResult = await result.current.runQuery(SAMPLE_QUERY);
    });

    expect(queryResult).toBeNull();
    expect(result.current.chartData).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  test("handles thrown exception gracefully", async () => {
    mockExecuteQueryAction.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useChartQuery("env-1"));

    let queryResult: unknown;
    await act(async () => {
      queryResult = await result.current.runQuery(SAMPLE_QUERY);
    });

    expect(queryResult).toBeNull();
    expect(result.current.error).toBe("Network failure");
    expect(result.current.isLoading).toBe(false);
  });

  test("passes environmentId and query to executeQueryAction", async () => {
    mockExecuteQueryAction.mockResolvedValue({
      data: [{ "FeedbackRecords.count": 1 }],
    });

    const { result } = renderHook(() => useChartQuery("env-abc"));

    await act(async () => {
      await result.current.runQuery(SAMPLE_QUERY);
    });

    expect(mockExecuteQueryAction).toHaveBeenCalledWith({
      environmentId: "env-abc",
      query: SAMPLE_QUERY,
    });
  });
});
