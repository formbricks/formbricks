"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TChartConfig } from "@formbricks/types/analysis";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { deleteChartAction } from "@/modules/ee/analysis/charts/actions";
import { prepareQueryForChartType } from "@/modules/ee/analysis/charts/lib/big-number";
import { sanitizeChartDisplay } from "@/modules/ee/analysis/charts/lib/chart-display";
import { resolveChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { addChartToDashboardAction, getDashboardsAction } from "@/modules/ee/analysis/dashboards/actions";
import {
  createChart,
  getChart,
  getChartApiErrorMessage,
  previewChart,
  updateChart,
} from "@/modules/ee/analysis/lib/api-client";
import { chartKeys } from "@/modules/ee/analysis/lib/query";
import type {
  AnalyticsResponse,
  TChart,
  TChartType,
  TChartWithCreator,
} from "@/modules/ee/analysis/types/analysis";

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
  const [, startTransition] = useTransition();
  const [selectedChartType, setSelectedChartType] = useState<TChartType | undefined>();
  const [chartData, setChartData] = useState<AnalyticsResponse | null>(null);
  // Display settings saved alongside the chart (display type, bar direction).
  const [chartConfig, setChartConfig] = useState<TChartConfig>({});
  const [isAddToDashboardDialogOpen, setIsAddToDashboardDialogOpen] = useState(false);
  const [chartName, setChartName] = useState("");
  // Saved name of the chart being edited; unlike chartName it stays stable while the user types.
  const [savedChartName, setSavedChartName] = useState("");
  const [dashboards, setDashboards] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [chartLoadError, setChartLoadError] = useState<string | null>(null);
  const [currentChartId, setCurrentChartId] = useState<string | undefined>(chartId);
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string | null>(directories?.[0]?.id ?? null);
  // Last name we prefilled from a suggestion; lets a regenerate replace its own
  // stale suggestion without ever clobbering a name the user typed.
  const lastSuggestedNameRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (isAddToDashboardDialogOpen) {
      getDashboardsAction({ workspaceId }).then((result) => {
        if (cancelled) return;
        if (result?.data) {
          setDashboards(result.data.map((d) => ({ id: d.id, name: d.name })));
        } else if (result?.serverError) {
          toast.error(getFormattedErrorMessage(result));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [isAddToDashboardDialogOpen, workspaceId]);

  useEffect(() => {
    let cancelled = false;

    if (!open) return;

    if (!chartId) {
      setChartData(null);
      setChartName("");
      setSavedChartName("");
      lastSuggestedNameRef.current = null;
      setSelectedChartType(undefined);
      setCurrentChartId(undefined);
      setChartConfig({});
      setSelectedDirectoryId(directories?.[0]?.id ?? null);
      return;
    }

    const load = async () => {
      setIsLoadingChart(true);
      setChartLoadError(null);

      try {
        const chart: TChart = initialChart?.id === chartId ? initialChart : await getChart(chartId);
        if (cancelled) return;

        setChartName(chart.name);
        setSavedChartName(chart.name);
        setSelectedChartType(resolveChartType(chart.type));
        setCurrentChartId(chart.id);
        setChartConfig(chart.config ?? {});
        setSelectedDirectoryId(chart.feedbackDirectoryId);

        // Charts saved before a big number's query stopped carrying groups can still hold a
        // granularity or a dimension; normalize on read so the value shown is the measure over the
        // whole range, not a fold of per-group values.
        const chartType = resolveChartType(chart.type);
        const result = await previewChart({
          workspaceId,
          datasetId: chart.feedbackDirectoryId,
          type: chartType,
          query: prepareQueryForChartType(chart.query, chartType),
        });
        if (cancelled) return;

        // The server-rewritten effective query, so the renderer's xAxisKey matches the returned data
        // columns (e.g. valueText → valueId for single-select).
        setChartData({
          query: result.query,
          chartType,
          data: result.rows,
          ...(Object.keys(result.optionLabels).length > 0 ? { optionLabels: result.optionLabels } : {}),
          ...(Object.keys(result.fieldLabels).length > 0 ? { fieldLabels: result.fieldLabels } : {}),
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

  const handleSaveChart = async () => {
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
        await updateChart(currentChartId, chartToSave);
        toast.success(t("workspace.analysis.charts.chart_updated_successfully"));
      } else {
        const created = await createChart({ workspaceId, datasetId: selectedDirectoryId, ...chartToSave });
        setCurrentChartId(created.id);
        savedChartId = created.id;
        newlyCreatedChartId = created.id;
        toast.success(t("workspace.analysis.charts.chart_saved_successfully"));
      }

      if (autoAddToDashboardId && savedChartId) {
        const addResult = await addChartToDashboardAction({
          workspaceId,
          chartId: savedChartId,
          dashboardId: autoAddToDashboardId,
        });

        if (!addResult?.data) {
          toast.error(
            getFormattedErrorMessage(addResult) ||
              t("workspace.analysis.charts.failed_to_add_chart_to_dashboard")
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
      startTransition(() => {
        router.refresh();
      });
      onSuccess?.();
    } catch (error: unknown) {
      toast.error(getChartApiErrorMessage(error, t("workspace.analysis.charts.failed_to_save_chart")));
      if (autoAddToDashboardId && newlyCreatedChartId) await cleanupOrphanChart(newlyCreatedChartId);
    } finally {
      setIsSaving(false);
    }
  };

  const cleanupOrphanChart = async (orphanChartId: string) => {
    await deleteChartAction({ workspaceId, chartId: orphanChartId }).catch(() => {});
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

      const widgetResult = await addChartToDashboardAction({
        workspaceId,
        chartId: chartIdToUse,
        dashboardId: selectedDashboardId,
      });

      if (!widgetResult?.data) {
        toast.error(
          (widgetResult && getFormattedErrorMessage(widgetResult)) ||
            t("workspace.analysis.charts.failed_to_add_chart_to_dashboard")
        );
        if (newlyCreatedChartId) await cleanupOrphanChart(newlyCreatedChartId);
        return;
      }

      toast.success(t("workspace.analysis.charts.chart_added_to_dashboard"));
      setIsAddToDashboardDialogOpen(false);
      closeDialog();
      void queryClient.invalidateQueries({ queryKey: chartKeys.all });
      startTransition(() => {
        router.refresh();
      });
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

  const initialQuery = initialChart && initialChart.id === chartId ? initialChart.query : undefined;

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
    selectedDirectoryId,
    setSelectedDirectoryId,
    handleChartGenerated,
    handleSaveChart,
    handleAddToDashboard,
    handleClose,
    handleChartTypeChange,
  };
}
