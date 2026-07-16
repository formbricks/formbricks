/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";

const mockExecuteQueryAction = vi.fn();

vi.mock("@/modules/ee/analysis/charts/actions", () => ({
  executeQueryAction: (...args: unknown[]) => mockExecuteQueryAction(...args),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: (result: { serverError?: string }) => result?.serverError ?? "formatted-error",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { useChartQuery } = await import("./use-chart-query");

const WORKSPACE_ID = "ws-123";
const DIRECTORY_ID = "frd-1";

const sampleQuery: TChartQuery = {
  measures: ["FeedbackRecords.count"],
  dimensions: ["FeedbackRecords.sourceType"],
};

const sampleData = [{ "FeedbackRecords.count": 5, "FeedbackRecords.sourceType": "survey" }];

describe("useChartQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("initializes query from initialQuery", () => {
    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID, sampleQuery));

    expect(result.current.query).toEqual(sampleQuery);
    expect(result.current.chartData).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("sets error and returns null when feedback directory is missing", async () => {
    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, null));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery);
    });

    expect(response).toBeNull();
    expect(result.current.error).toBe("workspace.analysis.charts.select_data_source_first");
    expect(mockExecuteQueryAction).not.toHaveBeenCalled();
  });

  test("returns query result and updates state on success", async () => {
    mockExecuteQueryAction.mockResolvedValue({ data: { rows: sampleData } });

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery);
    });

    expect(mockExecuteQueryAction).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      query: sampleQuery,
      feedbackDirectoryId: DIRECTORY_ID,
    });
    expect(response).toEqual({ query: sampleQuery, data: sampleData });
    expect(result.current.chartData).toEqual(sampleData);
    expect(result.current.query).toEqual(sampleQuery);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  test("sets formatted error when server returns an error", async () => {
    mockExecuteQueryAction.mockResolvedValue({ serverError: "query-failed" });

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery);
    });

    expect(response).toBeNull();
    expect(result.current.error).toBe("query-failed");
    expect(result.current.isLoading).toBe(false);
  });

  test("treats empty data as success so chart can still be saved", async () => {
    mockExecuteQueryAction.mockResolvedValue({ data: { rows: [] } });

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery);
    });

    expect(response).toEqual({ query: sampleQuery, data: [] });
    expect(result.current.chartData).toEqual([]);
    expect(result.current.query).toEqual(sampleQuery);
    expect(result.current.error).toBeNull();
  });

  test("sets error message when executeQueryAction throws an Error", async () => {
    mockExecuteQueryAction.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery);
    });

    expect(response).toBeNull();
    expect(result.current.error).toBe("network down");
    expect(result.current.isLoading).toBe(false);
  });

  test("sets fallback error when executeQueryAction throws a non-Error", async () => {
    mockExecuteQueryAction.mockRejectedValue("boom");

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery);
    });

    expect(response).toBeNull();
    expect(result.current.error).toBe("workspace.analysis.charts.failed_to_execute_query");
  });

  test("threads optionLabels through QueryResult when the server returns them", async () => {
    const optionLabels = { "c-male": "Male", "c-female": "Female" };
    mockExecuteQueryAction.mockResolvedValue({ data: { rows: sampleData, optionLabels } });

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery);
    });

    expect(response).toEqual({ query: sampleQuery, data: sampleData, optionLabels });
  });

  test("uses effectiveQuery from server response as the QueryResult query when present", async () => {
    // Server rewrites valueText → valueId for a single-select question.
    const effectiveQuery: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueId"],
    };
    const optionLabels = { opt1: "Option A", opt2: "Option B" };
    mockExecuteQueryAction.mockResolvedValue({
      data: { rows: sampleData, optionLabels, effectiveQuery },
    });

    const clientQuery: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueText"],
    };

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(clientQuery);
    });

    // The returned QueryResult.query must be the server-rewritten effectiveQuery, not the
    // client-side query. This ensures the renderer's xAxisKey matches the data columns.
    expect(response).toEqual({ query: effectiveQuery, data: sampleData, optionLabels });
    expect(result.current.query).toEqual(effectiveQuery);
  });

  test("falls back to client query when server does not return effectiveQuery", async () => {
    // Server returns no effectiveQuery (e.g. no value dimension rewrite needed).
    mockExecuteQueryAction.mockResolvedValue({ data: { rows: sampleData } });

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery);
    });

    expect(response).toEqual({ query: sampleQuery, data: sampleData });
    expect(result.current.query).toEqual(sampleQuery);
  });

  test("ignores stale responses when a newer query supersedes an older one", async () => {
    let resolveFirst: ((value: { data: { rows: typeof sampleData } }) => void) | undefined;
    const firstPromise = new Promise<{ data: { rows: typeof sampleData } }>((resolve) => {
      resolveFirst = resolve;
    });
    const secondData = [{ "FeedbackRecords.count": 9, "FeedbackRecords.sourceType": "link" }];

    mockExecuteQueryAction
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({ data: { rows: secondData } });

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let firstResponse: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    let secondResponse: Awaited<ReturnType<typeof result.current.runQuery>> = null;

    await act(async () => {
      const firstRun = result.current.runQuery(sampleQuery);
      const secondRun = result.current.runQuery({
        ...sampleQuery,
        dimensions: ["FeedbackRecords.status"],
      });
      secondResponse = await secondRun;
      resolveFirst?.({ data: { rows: sampleData } });
      firstResponse = await firstRun;
    });

    expect(firstResponse).toBeNull();
    expect(secondResponse).toEqual({
      query: { ...sampleQuery, dimensions: ["FeedbackRecords.status"] },
      data: secondData,
    });
    expect(result.current.chartData).toEqual(secondData);
    expect(result.current.isLoading).toBe(false);
  });

  test("ignores stale responses when scope changes during an in-flight request", async () => {
    let resolveFirst: ((value: { data: { rows: typeof sampleData } }) => void) | undefined;
    const firstPromise = new Promise<{ data: { rows: typeof sampleData } }>((resolve) => {
      resolveFirst = resolve;
    });
    const NEW_DIRECTORY_ID = "frd-2";
    const secondData = [{ "FeedbackRecords.count": 9, "FeedbackRecords.sourceType": "link" }];

    mockExecuteQueryAction
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({ data: { rows: secondData } });

    const { result, rerender } = renderHook(
      ({ feedbackDirectoryId }: { feedbackDirectoryId: string | null }) =>
        useChartQuery(WORKSPACE_ID, feedbackDirectoryId),
      { initialProps: { feedbackDirectoryId: DIRECTORY_ID } }
    );

    await act(async () => {
      void result.current.runQuery(sampleQuery);
    });

    rerender({ feedbackDirectoryId: NEW_DIRECTORY_ID });

    await act(async () => {
      resolveFirst?.({ data: { rows: sampleData } });
      await Promise.resolve();
    });

    expect(result.current.chartData).toBeNull();

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery);
    });

    expect(response).toEqual({ query: sampleQuery, data: secondData });
    expect(result.current.chartData).toEqual(secondData);
    expect(mockExecuteQueryAction).toHaveBeenLastCalledWith({
      workspaceId: WORKSPACE_ID,
      query: sampleQuery,
      feedbackDirectoryId: NEW_DIRECTORY_ID,
    });
  });
});
