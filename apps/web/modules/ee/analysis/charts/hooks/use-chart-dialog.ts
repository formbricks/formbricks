"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TChartConfig, TChartQuery } from "@formbricks/types/analysis";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { sanitizeChartDisplay } from "@/modules/ee/analysis/charts/lib/chart-display";
import { chartUpdateFromEditor } from "@/modules/ee/analysis/charts/lib/chart-update";
import { resolveChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { useDashboardOptions } from "@/modules/ee/analysis/dashboards/hooks/use-dashboard-options";
import {
  addDashboardWidget,
  createChart,
  deleteChart,
  getChart,
  getChartApiErrorMessage,
  getChartData,
  updateChart,
} from "@/modules/ee/analysis/lib/api-client";
import { chartKeys, dashboardKeys } from "@/modules/ee/analysis/lib/query";
import type {
  AnalyticsResponse,
  TChart,
  TChartType,
  TChartWithCreator,
} from "@/modules/ee/analysis/types/analysis";

const NO_DASHBOARDS: { id: string; name: string }[] = [];

export interface UseChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  chartId?: string;
  autoAddToDashboardId?: string;
  /** Pre-loaded chart metadata; when provided for edit, skips the chart read */
  initialChart?: TChartWithCreator;
  onSuccess?: () => void;
  directories?: { id: string; name: string }[];
}

export function useChartDialog({
  open,
  onOpenChange,
  workspaceId,
  chartId,
  autoAddToDashboardId,
  initialChart,
  onSuccess,
  directories,
}: Readonly<UseChartDialogProps>) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [selectedChartType, setSelectedChartType] = useState<TChartType | undefined>();
  const [chartData, setChartData] = useState<AnalyticsResponse | null>(null);
  // Display settings saved alongside the chart (display type, bar direction).
  const [chartConfig, setChartConfig] = useState<TChartConfig>({});
  const [isAddToDashboardDialogOpen, setIsAddToDashboardDialogOpen] = useState(false);
  const [chartName, setChartName] = useState("");
  // Saved name of the chart being edited; unlike chartName it stays stable while the user types.
  const [savedChartName, setSavedChartName] = useState("");
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [chartLoadError, setChartLoadError] = useState<string | null>(null);
  const [currentChartId, setCurrentChartId] = useState<string | undefined>(chartId);
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string | null>(directories?.[0]?.id ?? null);
  // Last name we prefilled from a suggestion; lets a regenerate replace its own
  // stale suggestion without ever clobbering a name the user typed.
  const lastSuggestedNameRef = useRef<string | null>(null);
  // The type and query as the saved chart was loaded, so a save sends them only when they changed.
  const loadedChartRef = useRef<{ type: TChartType; query: TChartQuery } | null>(null);
  // The saved chart whose own details loaded, whether or not its data did, with its stored query and
  // whether its data was refused (403): its Feedback Dataset out of the caller's reach.
  const [loadedChart, setLoadedChart] = useState<{
    id: string;
    query: TChartQuery;
    dataRefused: boolean;
  } | null>(null);

  const dashboardOptions = useDashboardOptions({ workspaceId, enabled: isAddToDashboardDialogOpen });
  const dashboards = dashboardOptions.data ?? NO_DASHBOARDS;
  useEffect(() => {
    if (dashboardOptions.error) {
      toast.error(
        getChartApiErrorMessage(
          dashboardOptions.error,
          t("workspace.analysis.charts.failed_to_load_dashboards")
        )
      );
    }
  }, [dashboardOptions.error, t]);

  useEffect(() => {
    let cancelled = false;

    if (!open) return;

    if (!chartId) {
      setChartData(null);
      setChartName("");
      setSavedChartName("");
      lastSuggestedNameRef.current = null;
      loadedChartRef.current = null;
      setLoadedChart(null);
      setSelectedChartType(undefined);
      setCurrentChartId(undefined);
      setChartConfig({});
      setSelectedDirectoryId(directories?.[0]?.id ?? null);
      return;
    }

    const load = async () => {
      setIsLoadingChart(true);
      setChartLoadError(null);
      // Set again once this chart's data loads: until then there is nothing to compare a save with, so it
      // sends everything rather than another chart's type and query.
      loadedChartRef.current = null;
      setLoadedChart(null);

      try {
        const chart: TChart = initialChart?.id === chartId ? initialChart : await getChart(chartId);
        if (cancelled) return;

        setChartName(chart.name);
        setSavedChartName(chart.name);
        setSelectedChartType(resolveChartType(chart.type));
        setCurrentChartId(chart.id);
        setChartConfig(chart.config ?? {});
        setSelectedDirectoryId(chart.feedbackDirectoryId);
        setLoadedChart({ id: chart.id, query: chart.query, dataRefused: false });

        // The saved chart's own data. The server shapes the query for the chart type, so a big number
        // saved while its query still carried groups shows the measure over the whole range.
        const chartType = resolveChartType(chart.type);
        const result = await getChartData({ chartId: chart.id }).catch((error: unknown) => {
          if (error instanceof V3ApiError && error.status === 403 && !cancelled) {
            setLoadedChart({ id: chart.id, query: chart.query, dataRefused: true });
          }
          throw new Error(
            getChartApiErrorMessage(error, t("workspace.analysis.charts.failed_to_load_chart_data"))
          );
        });
        if (cancelled) return;

        // The server-rewritten effective query, so the renderer's xAxisKey matches the returned data
        // columns (e.g. valueText → valueId for single-select).
        loadedChartRef.current = { type: chartType, query: result.query };
        setChartData({
          query: result.query,
          chartType,
          data: result.rows,
          ...(result.optionLabels ? { optionLabels: result.optionLabels } : {}),
          ...(result.fieldLabels ? { fieldLabels: result.fieldLabels } : {}),
          ...(result.memberLabels ? { memberLabels: result.memberLabels } : {}),
        });
      } catch (error: unknown) {
        if (cancelled) return;
        const message = getChartApiErrorMessage(error, t("workspace.analysis.charts.failed_to_load_chart"));
        toast.error(message);
        setChartLoadError(message);
      } finally {
        if (!cancelled) setIsLoadingChart(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // Key on initialChart?.id, NOT the object reference: a parent re-render hands over a new
    // `initialChart` reference with the same content, and depending on the object would re-run the
    // preview on every one of them. The id is the stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chartId, workspaceId, initialChart?.id]);

  const handleChartGenerated = (data: AnalyticsResponse) => {
    setChartData(data);
    // A saved chart whose data failed to load (a timeout, a range over the bucket limit) is fixed by
    // running another query; once one runs, the old error no longer describes the preview.
    setChartLoadError(null);
    setSelectedChartType(data.chartType);
    if (data.config) setChartConfig(data.config);
    const suggestedName = data.suggestedName?.trim();
    if (suggestedName) {
      // Functional updater: the AI response lands async, so a closure over chartName could be
      // stale and clobber a name the user typed while the request was in flight.
      setChartName((prev) => {
        if (prev.trim() && prev !== lastSuggestedNameRef.current) return prev;
        lastSuggestedNameRef.current = suggestedName;
        return suggestedName;
      });
    }
  };

  /** The saved chart itself loaded, so the editor opens even if its data did not. */
  const isChartLoaded = loadedChart !== null && loadedChart.id === currentChartId;

  /**
   * A saved chart whose data was refused — its Feedback Dataset no longer reachable — can still be renamed,
   * and only that: the editor shows no query, type or display settings, and the save sends the name alone.
   * Any other data failure leaves the full editor, where running a query fixes it.
   */
  const canSaveDetailsOnly = isChartLoaded && loadedChart.dataRefused && !chartData && !isLoadingChart;

  const saveChartDetails = async (chartId: string) => {
    if (!chartName.trim()) {
      toast.error(t("workspace.analysis.charts.please_enter_chart_name"));
      return;
    }
    setIsSaving(true);
    try {
      await updateChart(chartId, { name: chartName.trim() });
      toast.success(t("workspace.analysis.charts.chart_updated_successfully"));
      closeDialog();
      void queryClient.invalidateQueries({ queryKey: chartKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      onSuccess?.();
    } catch (error: unknown) {
      toast.error(getChartApiErrorMessage(error, t("workspace.analysis.charts.failed_to_save_chart")));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveChart = async () => {
    if (canSaveDetailsOnly && currentChartId) {
      await saveChartDetails(currentChartId);
      return;
    }
    if (!chartData || !chartName.trim()) {
      toast.error(t("workspace.analysis.charts.please_enter_chart_name"));
      return;
    }

    if (!selectedDirectoryId) {
      toast.error(t("workspace.analysis.charts.select_data_source_first"));
      return;
    }

    setIsSaving(true);
    let newlyCreatedChartId: string | null = null;
    const configToSave = sanitizeChartDisplay(chartConfig, chartData.chartType);
    try {
      let savedChartId = currentChartId;

      const chartToSave = {
        name: chartName.trim(),
        type: chartData.chartType,
        query: chartData.query,
        config: configToSave,
      };

      if (currentChartId) {
        await updateChart(currentChartId, chartUpdateFromEditor(chartToSave, loadedChartRef.current));
        loadedChartRef.current = { type: chartToSave.type, query: chartToSave.query };
        toast.success(t("workspace.analysis.charts.chart_updated_successfully"));
      } else {
        const created = await createChart({ workspaceId, datasetId: selectedDirectoryId, ...chartToSave });
        setCurrentChartId(created.id);
        savedChartId = created.id;
        newlyCreatedChartId = created.id;
        toast.success(t("workspace.analysis.charts.chart_saved_successfully"));
      }

      if (autoAddToDashboardId && savedChartId) {
        try {
          await addDashboardWidget(autoAddToDashboardId, { chartId: savedChartId });
        } catch (error) {
          toast.error(
            getChartApiErrorMessage(error, t("workspace.analysis.charts.failed_to_add_chart_to_dashboard"))
          );
          if (newlyCreatedChartId) await cleanupOrphanChart(newlyCreatedChartId);
          return;
        }

        toast.success(t("workspace.analysis.charts.chart_added_to_dashboard"));
      }

      closeDialog();
      if (autoAddToDashboardId) {
        const dashboardPath = `/workspaces/${workspaceId}/dashboards/${autoAddToDashboardId}`;
        if (pathname !== dashboardPath) {
          router.push(dashboardPath);
        }
      }
      void queryClient.invalidateQueries({ queryKey: chartKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      onSuccess?.();
    } catch (error: unknown) {
      toast.error(getChartApiErrorMessage(error, t("workspace.analysis.charts.failed_to_save_chart")));
      if (autoAddToDashboardId && newlyCreatedChartId) await cleanupOrphanChart(newlyCreatedChartId);
    } finally {
      setIsSaving(false);
    }
  };

  const cleanupOrphanChart = async (orphanChartId: string) => {
    await deleteChart(orphanChartId).catch(() => {});
    setCurrentChartId(undefined);
  };

  /** Returns the chart ID to use (existing or newly created), or null on failure. */
  const ensureChartForDashboard = async (data: AnalyticsResponse): Promise<string | null> => {
    if (currentChartId) return currentChartId;

    if (!selectedDirectoryId) {
      toast.error(t("workspace.analysis.charts.select_data_source_first"));
      return null;
    }

    try {
      const created = await createChart({
        workspaceId,
        datasetId: selectedDirectoryId,
        name: chartName.trim(),
        type: data.chartType,
        query: data.query,
        config: sanitizeChartDisplay(chartConfig, data.chartType),
      });
      setCurrentChartId(created.id);
      return created.id;
    } catch (error) {
      toast.error(getChartApiErrorMessage(error, t("workspace.analysis.charts.failed_to_save_chart")));
      return null;
    }
  };

  const handleAddToDashboard = async () => {
    if (!chartData || !selectedDashboardId) {
      toast.error(t("workspace.analysis.charts.please_select_dashboard"));
      return;
    }

    if (!currentChartId && !chartName.trim()) {
      toast.error(t("workspace.analysis.charts.please_enter_chart_name"));
      return;
    }

    setIsSaving(true);
    let newlyCreatedChartId: string | null = null;
    try {
      const chartIdToUse = await ensureChartForDashboard(chartData);
      if (!chartIdToUse) return;
      if (!currentChartId) newlyCreatedChartId = chartIdToUse;

      try {
        await addDashboardWidget(selectedDashboardId, { chartId: chartIdToUse });
      } catch (error) {
        toast.error(
          getChartApiErrorMessage(error, t("workspace.analysis.charts.failed_to_add_chart_to_dashboard"))
        );
        if (newlyCreatedChartId) await cleanupOrphanChart(newlyCreatedChartId);
        return;
      }

      toast.success(t("workspace.analysis.charts.chart_added_to_dashboard"));
      setIsAddToDashboardDialogOpen(false);
      closeDialog();
      void queryClient.invalidateQueries({ queryKey: chartKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      onSuccess?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("workspace.analysis.charts.failed_to_add_chart_to_dashboard");
      toast.error(message);
      if (newlyCreatedChartId) await cleanupOrphanChart(newlyCreatedChartId);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Every close goes through here. A chart left behind after one close is not just stale data: the
   * next open renders one frame carrying it, and anything that reads the state on that frame — the
   * unsaved-changes baseline above all — sees the previous session's chart and concludes the fresh,
   * untouched builder already has work in it.
   */
  const resetDialogState = () => {
    setChartData(null);
    setChartName("");
    setSavedChartName("");
    lastSuggestedNameRef.current = null;
    loadedChartRef.current = null;
    setLoadedChart(null);
    setSelectedChartType(undefined);
    setCurrentChartId(undefined);
    setChartConfig({});
    setChartLoadError(null);
    setSelectedDirectoryId(directories?.[0]?.id ?? null);
  };

  const closeDialog = () => {
    resetDialogState();
    onOpenChange(false);
  };

  const handleClose = () => {
    if (!isSaving) closeDialog();
  };

  const handleChartTypeChange = (type: TChartType) => {
    setSelectedChartType(type);
    setChartData((prev) => (prev ? { ...prev, chartType: type } : null));
  };

  // The stored query, so the builder starts from it rather than empty — and so counts as unchanged — also
  // when the editor fetched the chart itself, as it does when opened from a dashboard.
  const initialQuery = chartId
    ? [initialChart, loadedChart].find((chart) => chart?.id === chartId)?.query
    : undefined;

  return {
    chartData,
    chartConfig,
    setChartConfig,
    chartName,
    setChartName,
    savedChartName,
    selectedChartType,
    initialQuery,
    setSelectedChartType,
    currentChartId,
    setCurrentChartId,
    isAddToDashboardDialogOpen,
    setIsAddToDashboardDialogOpen,
    dashboards,
    selectedDashboardId,
    setSelectedDashboardId,
    isSaving,
    isLoadingChart,
    chartLoadError,
    isChartLoaded,
    canSaveDetailsOnly,
    selectedDirectoryId,
    setSelectedDirectoryId,
    handleChartGenerated,
    handleSaveChart,
    handleAddToDashboard,
    handleClose,
    handleChartTypeChange,
  };
}
