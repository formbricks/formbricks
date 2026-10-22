/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";

const mockPreviewChart = vi.fn();

vi.mock("@/modules/ee/analysis/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/analysis/lib/api-client")>()),
  previewChart: (...args: unknown[]) => mockPreviewChart(...args),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { useChartQuery } = await import("./use-chart-query");
const { V3ApiError } = await import("@/modules/api/lib/v3-client");

/** A preview answer as the API client returns it: the query as it ran, and empty label maps. */
const previewOf = (
  rows: unknown[],
  query: TChartQuery = sampleQuery,
  labels: { optionLabels?: Record<string, string>; fieldLabels?: Record<string, string> } = {}
) => ({ rows, query, optionLabels: labels.optionLabels ?? {}, fieldLabels: labels.fieldLabels ?? {} });

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
      response = await result.current.runQuery(sampleQuery, "bar");
    });

    expect(response).toBeNull();
    expect(result.current.error).toBe("workspace.analysis.charts.select_data_source_first");
    expect(mockPreviewChart).not.toHaveBeenCalled();
  });

  test("returns query result and updates state on success", async () => {
    mockPreviewChart.mockResolvedValue(previewOf(sampleData));

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery, "bar");
    });

    expect(mockPreviewChart).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      datasetId: DIRECTORY_ID,
      type: "bar",
      query: sampleQuery,
      signal: expect.any(AbortSignal),
    });
    expect(response).toEqual({ query: sampleQuery, data: sampleData });
    expect(result.current.chartData).toEqual(sampleData);
    expect(result.current.query).toEqual(sampleQuery);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  test("shows the refusal's detail and the first problem it names", async () => {
    mockPreviewChart.mockRejectedValue(
      new V3ApiError({
        status: 422,
        detail: "The chart query is not valid",
        invalid_params: [{ name: "query.measures[0]", reason: "Not a field in the field catalog." }],
      })
    );

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery, "bar");
    });

    expect(response).toBeNull();
    expect(result.current.error).toBe("The chart query is not valid Not a field in the field catalog.");
    expect(result.current.isLoading).toBe(false);
  });

  test("treats empty data as success so chart can still be saved", async () => {
    mockPreviewChart.mockResolvedValue(previewOf([]));

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery, "bar");
    });

    expect(response).toEqual({ query: sampleQuery, data: [] });
    expect(result.current.chartData).toEqual([]);
    expect(result.current.query).toEqual(sampleQuery);
    expect(result.current.error).toBeNull();
  });

  test("sets error message when the request throws an Error", async () => {
    mockPreviewChart.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery, "bar");
    });

    expect(response).toBeNull();
    expect(result.current.error).toBe("network down");
    expect(result.current.isLoading).toBe(false);
  });

  test("sets fallback error when the request throws a non-Error", async () => {
    mockPreviewChart.mockRejectedValue("boom");

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery, "bar");
    });

    expect(response).toBeNull();
    expect(result.current.error).toBe("workspace.analysis.charts.failed_to_execute_query");
  });

  test("threads optionLabels through QueryResult when the server returns them", async () => {
    const optionLabels = { "c-male": "Male", "c-female": "Female" };
    mockPreviewChart.mockResolvedValue(previewOf(sampleData, sampleQuery, { optionLabels }));

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery, "bar");
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
    mockPreviewChart.mockResolvedValue(previewOf(sampleData, effectiveQuery, { optionLabels }));

    const clientQuery: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueText"],
    };

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(clientQuery, "bar");
    });

    // The returned QueryResult.query must be the server-rewritten effectiveQuery, not the
    // client-side query. This ensures the renderer's xAxisKey matches the data columns.
    expect(response).toEqual({ query: effectiveQuery, data: sampleData, optionLabels });
    expect(result.current.query).toEqual(effectiveQuery);
  });

  test("ignores stale responses when a newer query supersedes an older one", async () => {
    let resolveFirst: ((value: ReturnType<typeof previewOf>) => void) | undefined;
    const firstPromise = new Promise<ReturnType<typeof previewOf>>((resolve) => {
      resolveFirst = resolve;
    });
    const secondData = [{ "FeedbackRecords.count": 9, "FeedbackRecords.sourceType": "link" }];
    const secondQuery = { ...sampleQuery, dimensions: ["FeedbackRecords.status"] };

    mockPreviewChart
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce(previewOf(secondData, secondQuery));

    const { result } = renderHook(() => useChartQuery(WORKSPACE_ID, DIRECTORY_ID));

    let firstResponse: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    let secondResponse: Awaited<ReturnType<typeof result.current.runQuery>> = null;

    await act(async () => {
      const firstRun = result.current.runQuery(sampleQuery, "bar");
      const secondRun = result.current.runQuery(
        { ...sampleQuery, dimensions: ["FeedbackRecords.status"] },
        "bar"
      );
      secondResponse = await secondRun;
      resolveFirst?.(previewOf(sampleData));
      firstResponse = await firstRun;
    });

    expect(firstResponse).toBeNull();
    // The superseded request is aborted, not left to finish in the background.
    expect((mockPreviewChart.mock.calls[0][0] as { signal: AbortSignal }).signal.aborted).toBe(true);
    expect(secondResponse).toEqual({
      query: { ...sampleQuery, dimensions: ["FeedbackRecords.status"] },
      data: secondData,
    });
    expect(result.current.chartData).toEqual(secondData);
    expect(result.current.isLoading).toBe(false);
  });

  test("ignores stale responses when scope changes during an in-flight request", async () => {
    let resolveFirst: ((value: ReturnType<typeof previewOf>) => void) | undefined;
    const firstPromise = new Promise<ReturnType<typeof previewOf>>((resolve) => {
      resolveFirst = resolve;
    });
    const NEW_DIRECTORY_ID = "frd-2";
    const secondData = [{ "FeedbackRecords.count": 9, "FeedbackRecords.sourceType": "link" }];

    mockPreviewChart.mockReturnValueOnce(firstPromise).mockResolvedValueOnce(previewOf(secondData));

    const { result, rerender } = renderHook(
      ({ feedbackDirectoryId }: { feedbackDirectoryId: string | null }) =>
        useChartQuery(WORKSPACE_ID, feedbackDirectoryId),
      { initialProps: { feedbackDirectoryId: DIRECTORY_ID } }
    );

    await act(async () => {
      void result.current.runQuery(sampleQuery, "bar");
    });

    rerender({ feedbackDirectoryId: NEW_DIRECTORY_ID });

    await act(async () => {
      resolveFirst?.(previewOf(sampleData));
      await Promise.resolve();
    });

    expect(result.current.chartData).toBeNull();

    let response: Awaited<ReturnType<typeof result.current.runQuery>> = null;
    await act(async () => {
      response = await result.current.runQuery(sampleQuery, "bar");
    });

    expect(response).toEqual({ query: sampleQuery, data: secondData });
    expect(result.current.chartData).toEqual(secondData);
    expect(mockPreviewChart).toHaveBeenLastCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_ID, datasetId: NEW_DIRECTORY_ID, query: sampleQuery })
    );
  });
});
