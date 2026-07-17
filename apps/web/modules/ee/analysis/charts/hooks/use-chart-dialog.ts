"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  createChartAction,
  deleteChartAction,
  executeQueryAction,
  getChartAction,
  updateChartAction,
} from "@/modules/ee/analysis/charts/actions";
import { resolveChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { addChartToDashboardAction, getDashboardsAction } from "@/modules/ee/analysis/dashboards/actions";
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
  /** Pre-loaded chart metadata; when provided for edit, skips getChartAction */
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
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [selectedChartType, setSelectedChartType] = useState<TChartType | undefined>();
  const [chartData, setChartData] = useState<AnalyticsResponse | null>(null);
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
      setSelectedDirectoryId(directories?.[0]?.id ?? null);
      return;
    }

    const fetchChartById = async (id: string): Promise<TChart> => {
      const result = await getChartAction({ workspaceId, chartId: id });
      if (!result?.data) {
        throw new Error(
          getFormattedErrorMessage(result) || t("workspace.analysis.charts.failed_to_load_chart")
        );
      }
      return result.data;
    };

    const load = async () => {
      setIsLoadingChart(true);
      setChartLoadError(null);

      try {
        const chart = initialChart?.id === chartId ? initialChart : await fetchChartById(chartId);
        if (cancelled) return;

        setChartName(chart.name);
        setSavedChartName(chart.name);
        setSelectedChartType(resolveChartType(chart.type));
        setCurrentChartId(chart.id);
        setSelectedDirectoryId(chart.feedbackDirectoryId);

        const queryResult = await executeQueryAction({
          workspaceId,
          query: chart.query,
          feedbackDirectoryId: chart.feedbackDirectoryId,
        });
        if (cancelled) return;

        if (queryResult?.serverError) {
          const errorMsg =
            getFormattedErrorMessage(queryResult) || t("workspace.analysis.charts.failed_to_load_chart_data");
          toast.error(errorMsg);
          setChartLoadError(errorMsg);
          return;
        }

        if (!Array.isArray(queryResult?.data)) {
          const errorMsg = t("workspace.analysis.charts.no_data_returned_for_chart");
          toast.error(errorMsg);
          setChartLoadError(errorMsg);
          return;
        }

        setChartData({
          query: chart.query,
          chartType: resolveChartType(chart.type),
          data: queryResult.data,
        });
      } catch (error: unknown) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : t("workspace.analysis.charts.failed_to_load_chart");
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
    // Key on initialChart?.id, NOT the object reference. Every authenticated action here
    // (getChartAction / executeQueryAction) re-sets the Better Auth session cookie → Next.js route
    // refresh → new `initialChart` reference; depending on the object would re-fire executeQueryAction on
    // every refresh → infinite loop. The id is the stable identity; content is unchanged across refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chartId, workspaceId, initialChart?.id]);

  const handleChartGenerated = (data: AnalyticsResponse) => {
    setChartData(data);
    setSelectedChartType(data.chartType);
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
    try {
      let savedChartId = currentChartId;

      if (currentChartId) {
        const result = await updateChartAction({
          workspaceId,
          chartId: currentChartId,
          chartUpdateInput: {
            name: chartName.trim(),
            type: chartData.chartType,
            query: chartData.query,
            config: {},
          },
        });

        if (!result?.data) {
          const errorMessage = getFormattedErrorMessage(result);
          toast.error(errorMessage);
          return;
        }

        toast.success(t("workspace.analysis.charts.chart_updated_successfully"));
      } else {
        const result = await createChartAction({
          workspaceId,
          chartInput: {
            name: chartName.trim(),
            type: chartData.chartType,
            query: chartData.query,
            config: {},
            feedbackDirectoryId: selectedDirectoryId,
          },
        });

        if (!result?.data) {
          const errorMessage = getFormattedErrorMessage(result);
          toast.error(errorMessage);
          return;
        }

        setCurrentChartId(result.data.id);
        savedChartId = result.data.id;
        newlyCreatedChartId = result.data.id;
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

      onOpenChange(false);
      if (autoAddToDashboardId) {
        const dashboardPath = `/workspaces/${workspaceId}/dashboards/${autoAddToDashboardId}`;
        if (pathname !== dashboardPath) {
          router.push(dashboardPath);
        }
      }
      startTransition(() => {
        router.refresh();
      });
      onSuccess?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("workspace.analysis.charts.failed_to_save_chart");
      toast.error(message);
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

    const chartResult = await createChartAction({
      workspaceId,
      chartInput: {
        name: chartName.trim(),
        type: data.chartType,
        query: data.query,
        config: {},
        feedbackDirectoryId: selectedDirectoryId,
      },
    });

    if (!chartResult?.data) {
      toast.error(
        (chartResult && getFormattedErrorMessage(chartResult)) ||
          t("workspace.analysis.charts.failed_to_save_chart")
      );
      return null;
    }

    setCurrentChartId(chartResult.data.id);
    return chartResult.data.id;
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
      onOpenChange(false);
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

  const handleClose = () => {
    if (!isSaving) {
      setChartData(null);
      setChartName("");
      setSavedChartName("");
      lastSuggestedNameRef.current = null;
      setSelectedChartType(undefined);
      setCurrentChartId(undefined);
      setChartLoadError(null);
      setSelectedDirectoryId(directories?.[0]?.id ?? null);
      onOpenChange(false);
    }
  };

  const handleChartTypeChange = (type: TChartType) => {
    setSelectedChartType(type);
    setChartData((prev) => (prev ? { ...prev, chartType: type } : null));
  };

  const initialQuery = initialChart && initialChart.id === chartId ? initialChart.query : undefined;

  return {
    chartData,
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
