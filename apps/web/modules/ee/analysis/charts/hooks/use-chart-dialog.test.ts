/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";

const mockCreateChartAction = vi.fn();
const mockUpdateChartAction = vi.fn();
const mockDeleteChartAction = vi.fn();
const mockGetChartAction = vi.fn();
const mockExecuteQueryAction = vi.fn();
const mockAddChartToDashboardAction = vi.fn();
const mockGetDashboardsAction = vi.fn();

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();
let mockPathname = "/other-page";

vi.mock("@/modules/ee/analysis/charts/actions", () => ({
  createChartAction: (...args: any[]) => mockCreateChartAction(...args),
  updateChartAction: (...args: any[]) => mockUpdateChartAction(...args),
  deleteChartAction: (...args: any[]) => mockDeleteChartAction(...args),
  getChartAction: (...args: any[]) => mockGetChartAction(...args),
  executeQueryAction: (...args: any[]) => mockExecuteQueryAction(...args),
}));

vi.mock("@/modules/ee/analysis/dashboards/actions", () => ({
  addChartToDashboardAction: (...args: any[]) => mockAddChartToDashboardAction(...args),
  getDashboardsAction: (...args: any[]) => mockGetDashboardsAction(...args),
}));

vi.mock("@/modules/ee/analysis/charts/lib/chart-utils", () => ({
  resolveChartType: (type: string) => type,
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: (result: any) => result?.serverError ?? "formatted-error",
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
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
      mockCreateChartAction.mockResolvedValue({ data: { id: NEW_CHART_ID } });
      mockAddChartToDashboardAction.mockResolvedValue({ data: { ok: true } });

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

      expect(mockCreateChartAction).toHaveBeenCalledTimes(1);
      expect(mockAddChartToDashboardAction).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        chartId: NEW_CHART_ID,
        dashboardId: DASHBOARD_ID,
      });
      expect(mockDeleteChartAction).not.toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("workspace.analysis.charts.chart_added_to_dashboard");
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockRouterPush).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/dashboards/${DASHBOARD_ID}`);
      expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    test("skips navigation when already on the target dashboard page", async () => {
      mockCreateChartAction.mockResolvedValue({ data: { id: NEW_CHART_ID } });
      mockAddChartToDashboardAction.mockResolvedValue({ data: { ok: true } });
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
      expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
    });

    test("cleans up newly created chart when auto-add fails", async () => {
      mockCreateChartAction.mockResolvedValue({ data: { id: NEW_CHART_ID } });
      mockAddChartToDashboardAction.mockResolvedValue({ serverError: "boom" });
      mockDeleteChartAction.mockResolvedValue({ data: { id: NEW_CHART_ID } });

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

      expect(mockCreateChartAction).toHaveBeenCalledTimes(1);
      expect(mockDeleteChartAction).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        chartId: NEW_CHART_ID,
      });
      expect(mockToastError).toHaveBeenCalled();
    });

    test("cleans up newly created chart when auto-add throws unexpectedly", async () => {
      mockCreateChartAction.mockResolvedValue({ data: { id: NEW_CHART_ID } });
      mockAddChartToDashboardAction.mockRejectedValue(new Error("network down"));
      mockDeleteChartAction.mockResolvedValue({ data: { id: NEW_CHART_ID } });

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

      expect(mockDeleteChartAction).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        chartId: NEW_CHART_ID,
      });
      expect(mockToastError).toHaveBeenCalledWith("network down");
    });

    test("does not delete pre-existing chart when auto-add fails on update path", async () => {
      mockUpdateChartAction.mockResolvedValue({ data: { id: CHART_ID } });
      mockAddChartToDashboardAction.mockResolvedValue({ serverError: "boom" });

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

      expect(mockUpdateChartAction).toHaveBeenCalledTimes(1);
      expect(mockCreateChartAction).not.toHaveBeenCalled();
      expect(mockDeleteChartAction).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe("handleAddToDashboard - cleanup behavior", () => {
    test("cleans up newly created chart when widget add fails", async () => {
      mockCreateChartAction.mockResolvedValue({ data: { id: NEW_CHART_ID } });
      mockAddChartToDashboardAction.mockResolvedValue({ serverError: "boom" });
      mockDeleteChartAction.mockResolvedValue({ data: { id: NEW_CHART_ID } });

      const { result } = renderHook(() => useChartDialog(baseProps));

      await setHookReady(result);
      await act(async () => {
        result.current.setSelectedDashboardId(DASHBOARD_ID);
      });
      await act(async () => {
        await result.current.handleAddToDashboard();
      });

      expect(mockCreateChartAction).toHaveBeenCalledTimes(1);
      expect(mockAddChartToDashboardAction).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        chartId: NEW_CHART_ID,
        dashboardId: DASHBOARD_ID,
      });
      expect(mockDeleteChartAction).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        chartId: NEW_CHART_ID,
      });
    });

    test("does not delete pre-existing chart when widget add fails", async () => {
      mockAddChartToDashboardAction.mockResolvedValue({ serverError: "boom" });

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

      expect(mockCreateChartAction).not.toHaveBeenCalled();
      expect(mockDeleteChartAction).not.toHaveBeenCalled();
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
      expect(mockCreateChartAction).not.toHaveBeenCalled();
      expect(mockAddChartToDashboardAction).not.toHaveBeenCalled();
    });

    test("toasts when no dashboard selected", async () => {
      const { result } = renderHook(() => useChartDialog(baseProps));

      await setHookReady(result);
      await act(async () => {
        await result.current.handleAddToDashboard();
      });

      expect(mockToastError).toHaveBeenCalledWith("workspace.analysis.charts.please_select_dashboard");
      expect(mockAddChartToDashboardAction).not.toHaveBeenCalled();
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
      expect(mockCreateChartAction).not.toHaveBeenCalled();
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
      mockGetChartAction.mockResolvedValue({
        data: {
          id: CHART_ID,
          name: "Loaded Chart",
          type: "bar",
          query: sampleChartData.query,
          feedbackDirectoryId: DIRECTORY_ID,
        },
      });
      mockExecuteQueryAction.mockResolvedValue({ data: [] });

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
      mockGetChartAction.mockResolvedValue({
        data: {
          id: CHART_ID,
          name: "Loaded Chart",
          type: "bar",
          query: sampleChartData.query,
          feedbackDirectoryId: DIRECTORY_ID,
        },
      });
      mockExecuteQueryAction.mockResolvedValue({ data: [] });

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
      expect(mockCreateChartAction).not.toHaveBeenCalled();
    });

    test("toasts when create fails on the create branch", async () => {
      mockCreateChartAction.mockResolvedValue({ serverError: "create-failed" });

      const { result } = renderHook(() => useChartDialog(baseProps));

      await setHookReady(result);
      await act(async () => {
        await result.current.handleSaveChart();
      });

      expect(mockToastError).toHaveBeenCalledWith("create-failed");
      expect(mockAddChartToDashboardAction).not.toHaveBeenCalled();
    });

    test("toasts when update fails on the update branch", async () => {
      mockUpdateChartAction.mockResolvedValue({ serverError: "update-failed" });

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

      expect(mockUpdateChartAction).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledWith("update-failed");
    });
  });
});
