/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook as renderHookBase, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import type { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";

/** The dialog invalidates the chart queries after a save, so it renders inside a query client. */
const renderHook = <T>(callback: () => T) => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHookBase(callback, { wrapper });
};

const mockCreateChart = vi.fn();
const mockUpdateChart = vi.fn();
const mockDeleteChart = vi.fn();
const mockGetChart = vi.fn();
const mockGetChartData = vi.fn();
const mockAddDashboardWidget = vi.fn();

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();
let mockPathname = "/other-page";

vi.mock("@/modules/ee/analysis/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/analysis/lib/api-client")>()),
  createChart: (...args: unknown[]) => mockCreateChart(...args),
  updateChart: (...args: unknown[]) => mockUpdateChart(...args),
  getChart: (...args: unknown[]) => mockGetChart(...args),
  getChartData: (...args: unknown[]) => mockGetChartData(...args),
  addDashboardWidget: (...args: unknown[]) => mockAddDashboardWidget(...args),
  deleteChart: (...args: unknown[]) => mockDeleteChart(...args),
}));

vi.mock("@/modules/ee/analysis/charts/lib/chart-utils", () => ({
  resolveChartType: (type: string) => type,
}));

vi.mock("@/lib/utils/error-message", () => ({
  getFormattedErrorMessage: (result?: { serverError?: string }) => result?.serverError ?? "formatted-error",
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, refresh: mockRouterRefresh }),
  usePathname: () => mockPathname,
}));

const { useChartDialog } = await import("./use-chart-dialog");

const WORKSPACE_ID = "ws-123";
const DIRECTORY_ID = "frd-1";
const CHART_ID = "chart-1";
const NEW_CHART_ID = "chart-new";
const DASHBOARD_ID = "dash-1";

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  workspaceId: WORKSPACE_ID,
  directories: [{ id: DIRECTORY_ID, name: "Dir 1" }],
};

const sampleChartData: AnalyticsResponse = {
  query: { measures: ["FeedbackRecords.count"] },
  chartType: "bar",
  data: [],
};

const setHookReady = async (result: { current: ReturnType<typeof useChartDialog> }, withChartData = true) => {
  await act(async () => {
    if (withChartData) {
      result.current.handleChartGenerated(sampleChartData);
    }
    result.current.setChartName("My Chart");
  });
};

describe("useChartDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/other-page";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("handleSaveChart - create + auto-add", () => {
    test("creates chart and adds to dashboard on success without cleanup", async () => {
      mockCreateChart.mockResolvedValue({ id: NEW_CHART_ID });
      mockAddDashboardWidget.mockResolvedValue({ id: "widget_1" });

      const onOpenChange = vi.fn();
      const onSuccess = vi.fn();
      const { result } = renderHook(() =>
        useChartDialog({
          ...baseProps,
          onOpenChange,
          onSuccess,
          autoAddToDashboardId: DASHBOARD_ID,
        })
      );

      await setHookReady(result);
      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(mockCreateChart).toHaveBeenCalledTimes(1);
      expect(mockAddDashboardWidget).toHaveBeenCalledWith(DASHBOARD_ID, { chartId: NEW_CHART_ID });
      expect(mockDeleteChart).not.toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("workspace.analysis.charts.chart_added_to_dashboard");
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockRouterPush).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/dashboards/${DASHBOARD_ID}`);
      expect(mockRouterRefresh).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    test("skips navigation when already on the target dashboard page", async () => {
      mockCreateChart.mockResolvedValue({ id: NEW_CHART_ID });
      mockAddDashboardWidget.mockResolvedValue({ id: "widget_1" });
      mockPathname = `/workspaces/${WORKSPACE_ID}/dashboards/${DASHBOARD_ID}`;

      const { result } = renderHook(() =>
        useChartDialog({
          ...baseProps,
          autoAddToDashboardId: DASHBOARD_ID,
        })
      );

      await setHookReady(result);
      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(mockRouterPush).not.toHaveBeenCalled();
      expect(mockRouterRefresh).not.toHaveBeenCalled();
    });

    test("cleans up newly created chart when auto-add fails", async () => {
      mockCreateChart.mockResolvedValue({ id: NEW_CHART_ID });
      mockAddDashboardWidget.mockRejectedValue(new Error("boom"));
      mockDeleteChart.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useChartDialog({
          ...baseProps,
          autoAddToDashboardId: DASHBOARD_ID,
        })
      );

      await setHookReady(result);
      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(mockCreateChart).toHaveBeenCalledTimes(1);
      expect(mockDeleteChart).toHaveBeenCalledWith(NEW_CHART_ID);
      expect(mockToastError).toHaveBeenCalled();
    });

    test("cleans up newly created chart when auto-add throws unexpectedly", async () => {
      mockCreateChart.mockResolvedValue({ id: NEW_CHART_ID });
      mockAddDashboardWidget.mockRejectedValue(new Error("network down"));
      mockDeleteChart.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useChartDialog({
          ...baseProps,
          autoAddToDashboardId: DASHBOARD_ID,
        })
      );

      await setHookReady(result);
      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(mockDeleteChart).toHaveBeenCalledWith(NEW_CHART_ID);
      expect(mockToastError).toHaveBeenCalledWith("network down");
    });

    test("does not delete pre-existing chart when auto-add fails on update path", async () => {
      mockUpdateChart.mockResolvedValue({ id: CHART_ID });
      mockAddDashboardWidget.mockRejectedValue(new Error("boom"));

      const { result } = renderHook(() =>
        useChartDialog({
          ...baseProps,
          chartId: CHART_ID,
          autoAddToDashboardId: DASHBOARD_ID,
        })
      );

      await setHookReady(result);
      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(mockUpdateChart).toHaveBeenCalledTimes(1);
      expect(mockCreateChart).not.toHaveBeenCalled();
      expect(mockDeleteChart).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe("saving an edited chart", () => {
    const chartOf = (id: string, type: string) => ({
      id,
      name: `Chart ${id}`,
      type,
      config: {},
      feedbackDirectoryId: DIRECTORY_ID,
    });
    const loadedQuery = { measures: ["FeedbackRecords.count"] };

    test("sends the type and query only when they changed from the chart as loaded", async () => {
      mockGetChart.mockResolvedValue(chartOf(CHART_ID, "bar"));
      mockGetChartData.mockResolvedValue({ query: loadedQuery, rows: [] });
      mockUpdateChart.mockResolvedValue({ id: CHART_ID });

      const { result } = renderHook(() => useChartDialog({ ...baseProps, chartId: CHART_ID }));
      await waitFor(() => expect(result.current.chartData).not.toBeNull());
      act(() => result.current.setChartName("Renamed"));
      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(mockUpdateChart.mock.calls[0][1]).toEqual({ name: "Renamed", config: {} });
    });

    test("renames a chart whose data cannot load, sending the name alone even after a type was picked", async () => {
      mockGetChart.mockResolvedValue({ ...chartOf(CHART_ID, "bar"), query: loadedQuery });
      mockGetChartData.mockRejectedValue(
        new V3ApiError({ status: 403, detail: "You are not authorized to use this Feedback Dataset" })
      );
      mockUpdateChart.mockResolvedValue({ id: CHART_ID });

      const { result } = renderHook(() => useChartDialog({ ...baseProps, chartId: CHART_ID }));
      await waitFor(() => expect(result.current.canSaveDetailsOnly).toBe(true));
      expect(result.current.chartData).toBeNull();
      // Opened from a dashboard, with no initialChart: the builder still starts from the stored query.
      expect(result.current.initialQuery).toEqual(loadedQuery);

      act(() => {
        result.current.setChartName("Renamed orphan");
        result.current.handleChartTypeChange("pie");
      });
      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(mockUpdateChart).toHaveBeenCalledWith(CHART_ID, { name: "Renamed orphan" });
    });

    test("keeps the full editor when the data failed for another reason, and drops the error once a query runs", async () => {
      mockGetChart.mockResolvedValue({ ...chartOf(CHART_ID, "bar"), query: loadedQuery });
      mockGetChartData.mockRejectedValue(
        new V3ApiError({ status: 422, detail: "The date range spans too many buckets" })
      );

      const { result } = renderHook(() => useChartDialog({ ...baseProps, chartId: CHART_ID }));
      await waitFor(() => expect(result.current.chartLoadError).not.toBeNull());

      expect(result.current.isChartLoaded).toBe(true);
      expect(result.current.canSaveDetailsOnly).toBe(false);
      act(() => result.current.handleChartGenerated(sampleChartData));
      expect(result.current.chartLoadError).toBeNull();
    });

    test("offers no rename when the chart itself could not load", async () => {
      mockGetChart.mockRejectedValue(new Error("You are not authorized to access this chart"));

      const { result } = renderHook(() => useChartDialog({ ...baseProps, chartId: CHART_ID }));
      await waitFor(() => expect(result.current.chartLoadError).not.toBeNull());

      expect(result.current.canSaveDetailsOnly).toBe(false);
    });

    test("never compares a chart with the one opened before it, whose data loaded when its own did not", async () => {
      mockGetChart.mockImplementation(async (id: string) => chartOf(id, id === CHART_ID ? "area" : "bar"));
      mockGetChartData.mockImplementation(async ({ chartId }: { chartId: string }) => {
        if (chartId === CHART_ID) return { query: loadedQuery, rows: [] };
        throw new Error("no access to its dataset");
      });
      mockUpdateChart.mockResolvedValue({ id: "chart-2" });

      let chartId = CHART_ID;
      const { result, rerender } = renderHook(() => useChartDialog({ ...baseProps, chartId }));
      await waitFor(() => expect(result.current.chartData).not.toBeNull());

      chartId = "chart-2";
      rerender();
      await waitFor(() => expect(mockGetChartData).toHaveBeenCalledTimes(2));
      // The user builds the first chart's area query again for the second chart, a bar, and saves.
      await act(async () => {
        result.current.handleChartGenerated({ query: loadedQuery, chartType: "area", data: [] });
        result.current.setChartName("Second");
      });
      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(mockUpdateChart.mock.calls.at(-1)).toEqual([
        "chart-2",
        expect.objectContaining({ type: "area", query: loadedQuery }),
      ]);
    });
  });

  describe("closing clears the session", () => {
    // A chart left behind after a close is not just stale data: the next open renders one frame
    // still carrying it, and the unsaved-changes baseline captured on that frame concludes a fresh,
    // untouched builder already has work in it — which is how "Discard chart?" appeared on an
    // empty dialog nobody had touched.
    test("a successful save leaves nothing behind for the next open", async () => {
      mockCreateChart.mockResolvedValue({ id: NEW_CHART_ID });

      const onOpenChange = vi.fn();
      const { result } = renderHook(() => useChartDialog({ ...baseProps, onOpenChange }));

      await setHookReady(result);
      expect(result.current.chartName).toBe("My Chart");
      expect(result.current.chartData).not.toBeNull();

      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(result.current.chartName).toBe("");
      expect(result.current.chartData).toBeNull();
      expect(result.current.selectedChartType).toBeUndefined();
      expect(result.current.chartConfig).toEqual({});
    });

    test("handleClose clears it too, and does nothing mid-save", async () => {
      const onOpenChange = vi.fn();
      const { result } = renderHook(() => useChartDialog({ ...baseProps, onOpenChange }));

      await setHookReady(result);
      act(() => result.current.handleClose());

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(result.current.chartName).toBe("");
      expect(result.current.chartData).toBeNull();
    });
  });

  describe("starting from a preset (ENG-3331)", () => {
    test("adopts the preset's chart type, display settings and name, and saves them", async () => {
      mockCreateChart.mockResolvedValue({ id: NEW_CHART_ID });
      const { result } = renderHook(() => useChartDialog(baseProps));

      act(() =>
        result.current.handleChartGenerated({
          query: { measures: ["FeedbackRecords.npsScore"] },
          chartType: "area",
          config: { areaDisplay: "line" },
          suggestedName: "NPS over time",
        })
      );

      expect(result.current.selectedChartType).toBe("area");
      expect(result.current.chartConfig).toEqual({ areaDisplay: "line" });
      expect(result.current.chartName).toBe("NPS over time");

      await act(async () => {
        await result.current.handleSaveChart();
      });
      expect(mockCreateChart).toHaveBeenCalledWith(
        expect.objectContaining({ type: "area", config: { areaDisplay: "line" } })
      );
    });

    test("an AI chart without display settings keeps the ones already set", () => {
      const { result } = renderHook(() => useChartDialog(baseProps));
      act(() => result.current.setChartConfig({ barOrientation: "horizontal" }));
      act(() => result.current.handleChartGenerated(sampleChartData));
      expect(result.current.chartConfig).toEqual({ barOrientation: "horizontal" });
    });
  });

  describe("handleAddToDashboard - cleanup behavior", () => {
    test("cleans up newly created chart when widget add fails", async () => {
      mockCreateChart.mockResolvedValue({ id: NEW_CHART_ID });
      mockAddDashboardWidget.mockRejectedValue(new Error("boom"));
      mockDeleteChart.mockResolvedValue(undefined);

      const { result } = renderHook(() => useChartDialog(baseProps));

      await setHookReady(result);
      await act(async () => {
        result.current.setSelectedDashboardId(DASHBOARD_ID);
      });
      await act(async () => {
        await result.current.handleAddToDashboard();
      });

      expect(mockCreateChart).toHaveBeenCalledTimes(1);
      expect(mockAddDashboardWidget).toHaveBeenCalledWith(DASHBOARD_ID, { chartId: NEW_CHART_ID });
      expect(mockDeleteChart).toHaveBeenCalledWith(NEW_CHART_ID);
    });

    test("does not delete pre-existing chart when widget add fails", async () => {
      mockAddDashboardWidget.mockRejectedValue(new Error("boom"));

      const { result } = renderHook(() =>
        useChartDialog({
          ...baseProps,
          chartId: CHART_ID,
        })
      );

      // Pre-existing chart has currentChartId set via init. Skip the load-chart branch
      // by providing initialChart so the effect short-circuits.
      await act(async () => {
        result.current.setCurrentChartId(CHART_ID);
        result.current.handleChartGenerated(sampleChartData);
        result.current.setChartName("My Chart");
        result.current.setSelectedDashboardId(DASHBOARD_ID);
      });

      await act(async () => {
        await result.current.handleAddToDashboard();
      });

      expect(mockCreateChart).not.toHaveBeenCalled();
      expect(mockDeleteChart).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe("handleAddToDashboard - validation", () => {
    test("toasts and skips when name is empty for new chart", async () => {
      const { result } = renderHook(() => useChartDialog(baseProps));

      await act(async () => {
        result.current.handleChartGenerated(sampleChartData);
        result.current.setSelectedDashboardId(DASHBOARD_ID);
      });

      await act(async () => {
        await result.current.handleAddToDashboard();
      });

      expect(mockToastError).toHaveBeenCalledWith("workspace.analysis.charts.please_enter_chart_name");
      expect(mockCreateChart).not.toHaveBeenCalled();
      expect(mockAddDashboardWidget).not.toHaveBeenCalled();
    });

    test("toasts when no dashboard selected", async () => {
      const { result } = renderHook(() => useChartDialog(baseProps));

      await setHookReady(result);
      await act(async () => {
        await result.current.handleAddToDashboard();
      });

      expect(mockToastError).toHaveBeenCalledWith("workspace.analysis.charts.please_select_dashboard");
      expect(mockAddDashboardWidget).not.toHaveBeenCalled();
    });

    test("toasts when no directory available for new chart creation", async () => {
      const { result } = renderHook(() =>
        useChartDialog({
          open: true,
          onOpenChange: vi.fn(),
          workspaceId: WORKSPACE_ID,
          directories: [],
        })
      );

      await setHookReady(result);
      await act(async () => {
        result.current.setSelectedDashboardId(DASHBOARD_ID);
      });

      await act(async () => {
        await result.current.handleAddToDashboard();
      });

      expect(mockToastError).toHaveBeenCalledWith("workspace.analysis.charts.select_data_source_first");
      expect(mockCreateChart).not.toHaveBeenCalled();
    });
  });

  describe("handleChartGenerated", () => {
    test("prefills chart name from suggestedName when name is empty", async () => {
      const { result } = renderHook(() => useChartDialog(baseProps));

      await act(async () => {
        result.current.handleChartGenerated({
          ...sampleChartData,
          suggestedName: "Responses by Source",
        });
      });

      expect(result.current.chartName).toBe("Responses by Source");
    });

    test("does not overwrite an existing chart name with suggestedName", async () => {
      const { result } = renderHook(() => useChartDialog(baseProps));

      await act(async () => {
        result.current.setChartName("Custom Chart");
      });

      await act(async () => {
        result.current.handleChartGenerated({
          ...sampleChartData,
          suggestedName: "Responses by Source",
        });
      });

      expect(result.current.chartName).toBe("Custom Chart");
    });

    test("replaces a previously suggested name when the chart is regenerated", async () => {
      const { result } = renderHook(() => useChartDialog(baseProps));

      await act(async () => {
        result.current.handleChartGenerated({
          ...sampleChartData,
          suggestedName: "Responses by Source",
        });
      });

      await act(async () => {
        result.current.handleChartGenerated({
          ...sampleChartData,
          suggestedName: "NPS by Week",
        });
      });

      expect(result.current.chartName).toBe("NPS by Week");
    });

    test("keeps a user-edited name when the chart is regenerated", async () => {
      const { result } = renderHook(() => useChartDialog(baseProps));

      await act(async () => {
        result.current.handleChartGenerated({
          ...sampleChartData,
          suggestedName: "Responses by Source",
        });
      });

      await act(async () => {
        result.current.setChartName("My Custom Name");
      });

      await act(async () => {
        result.current.handleChartGenerated({
          ...sampleChartData,
          suggestedName: "NPS by Week",
        });
      });

      expect(result.current.chartName).toBe("My Custom Name");
    });

    test("preserves custom chart name when user types before delayed AI response completes", async () => {
      const { result } = renderHook(() => useChartDialog(baseProps));

      await act(async () => {
        result.current.setChartName("User Typed Name");
      });

      await act(async () => {
        result.current.handleChartGenerated({
          ...sampleChartData,
          suggestedName: "AI Generated Name",
        });
      });

      expect(result.current.chartName).toBe("User Typed Name");
    });

    test("preserves the user's name even when invoked through a stale closure", async () => {
      const { result } = renderHook(() => useChartDialog(baseProps));

      // Captured before the user types — like a consumer holding the callback across renders
      // while the AI request is in flight.
      const staleHandleChartGenerated = result.current.handleChartGenerated;

      await act(async () => {
        result.current.setChartName("User Typed Name");
      });

      await act(async () => {
        staleHandleChartGenerated({
          ...sampleChartData,
          suggestedName: "AI Generated Name",
        });
      });

      expect(result.current.chartName).toBe("User Typed Name");
    });
  });

  describe("savedChartName", () => {
    test("holds the loaded chart name and stays stable while the user renames", async () => {
      mockGetChart.mockResolvedValue({
        id: CHART_ID,
        name: "Loaded Chart",
        type: "bar",
        query: sampleChartData.query,
        feedbackDirectoryId: DIRECTORY_ID,
      });
      mockGetChartData.mockResolvedValue({
        rows: [],
        optionLabels: {},
        fieldLabels: {},
        query: sampleChartData.query,
      });

      const { result } = renderHook(() => useChartDialog({ ...baseProps, chartId: CHART_ID }));

      await waitFor(() => {
        expect(result.current.savedChartName).toBe("Loaded Chart");
      });
      expect(result.current.chartName).toBe("Loaded Chart");

      await act(async () => {
        result.current.setChartName("Renamed Chart");
      });

      expect(result.current.chartName).toBe("Renamed Chart");
      expect(result.current.savedChartName).toBe("Loaded Chart");
    });

    test("resets savedChartName when the dialog is closed without saving", async () => {
      mockGetChart.mockResolvedValue({
        id: CHART_ID,
        name: "Loaded Chart",
        type: "bar",
        query: sampleChartData.query,
        feedbackDirectoryId: DIRECTORY_ID,
      });
      mockGetChartData.mockResolvedValue({
        rows: [],
        optionLabels: {},
        fieldLabels: {},
        query: sampleChartData.query,
      });

      const onOpenChange = vi.fn();
      const { result } = renderHook(() => useChartDialog({ ...baseProps, onOpenChange, chartId: CHART_ID }));

      await waitFor(() => {
        expect(result.current.savedChartName).toBe("Loaded Chart");
      });

      await act(async () => {
        result.current.handleClose();
      });

      expect(result.current.savedChartName).toBe("");
      expect(result.current.chartName).toBe("");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    test("keeps savedChartName empty when opening in create mode", async () => {
      const { result } = renderHook(() => useChartDialog(baseProps));

      await waitFor(() => {
        expect(result.current.savedChartName).toBe("");
      });
    });
  });

  describe("handleSaveChart - validation + error paths", () => {
    test("toasts when chartName is empty", async () => {
      const { result } = renderHook(() => useChartDialog(baseProps));

      await act(async () => {
        result.current.handleChartGenerated(sampleChartData);
      });

      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(mockToastError).toHaveBeenCalledWith("workspace.analysis.charts.please_enter_chart_name");
      expect(mockCreateChart).not.toHaveBeenCalled();
    });

    test("toasts when create fails on the create branch", async () => {
      mockCreateChart.mockRejectedValue(new Error("create-failed"));

      const { result } = renderHook(() => useChartDialog(baseProps));

      await setHookReady(result);
      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(mockToastError).toHaveBeenCalledWith("create-failed");
      expect(mockAddDashboardWidget).not.toHaveBeenCalled();
    });

    test("toasts when update fails on the update branch", async () => {
      mockUpdateChart.mockRejectedValue(new Error("update-failed"));

      const { result } = renderHook(() =>
        useChartDialog({
          ...baseProps,
          chartId: CHART_ID,
        })
      );

      // Skip async load-chart branch by setting currentChartId directly
      await act(async () => {
        result.current.setCurrentChartId(CHART_ID);
        result.current.handleChartGenerated(sampleChartData);
        result.current.setChartName("My Chart");
      });

      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(mockUpdateChart).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledWith("update-failed");
    });
  });
});
