"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  environmentId: string;
  chartId?: string;
  /** Pre-loaded chart metadata; when provided for edit, skips getChartAction */
  initialChart?: TChartWithCreator;
  onSuccess?: () => void;
}

export function useChartDialog({
  open,
  onOpenChange,
  environmentId,
  chartId,
  initialChart,
  onSuccess,
}: Readonly<UseChartDialogProps>) {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedChartType, setSelectedChartType] = useState<TChartType | undefined>();
  const [chartData, setChartData] = useState<AnalyticsResponse | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isAddToDashboardDialogOpen, setIsAddToDashboardDialogOpen] = useState(false);
  const [chartName, setChartName] = useState("");
  const [dashboards, setDashboards] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [chartLoadError, setChartLoadError] = useState<string | null>(null);
  const [currentChartId, setCurrentChartId] = useState<string | undefined>(chartId);

  useEffect(() => {
    let cancelled = false;
    if (isAddToDashboardDialogOpen) {
      getDashboardsAction({ environmentId }).then((result) => {
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
  }, [isAddToDashboardDialogOpen, environmentId]);

  useEffect(() => {
    let cancelled = false;

    if (!open) return;

    if (!chartId) {
      setChartData(null);
      setChartName("");
      setSelectedChartType(undefined);
      setCurrentChartId(undefined);
      return;
    }

    const fetchChartById = async (id: string): Promise<TChart> => {
      const result = await getChartAction({ environmentId, chartId: id });
      if (!result?.data) {
        throw new Error(
          getFormattedErrorMessage(result) || t("environments.analysis.charts.failed_to_load_chart")
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
        setSelectedChartType(resolveChartType(chart.type));
        setCurrentChartId(chart.id);

        const queryResult = await executeQueryAction({ environmentId, query: chart.query });
        if (cancelled) return;

        if (queryResult?.serverError) {
          const errorMsg =
            getFormattedErrorMessage(queryResult) ||
            t("environments.analysis.charts.failed_to_load_chart_data");
          toast.error(errorMsg);
          setChartLoadError(errorMsg);
          return;
        }

        if (!Array.isArray(queryResult?.data)) {
          const errorMsg = t("environments.analysis.charts.no_data_returned_for_chart");
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
          error instanceof Error ? error.message : t("environments.analysis.charts.failed_to_load_chart");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chartId, environmentId, initialChart]);

  const handleChartGenerated = (data: AnalyticsResponse) => {
    setChartData(data);
    if (!currentChartId) {
      setChartName(
        data.chartType ? `${t("environments.analysis.charts.chart")} ${new Date().toLocaleString()}` : ""
      );
    }
    setSelectedChartType(data.chartType);
  };

  const handleSaveChart = async () => {
    if (!chartData || !chartName.trim()) {
      toast.error(t("environments.analysis.charts.please_enter_chart_name"));
      return;
    }

    setIsSaving(true);
    try {
      if (currentChartId) {
        const result = await updateChartAction({
          environmentId,
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

        toast.success(t("environments.analysis.charts.chart_updated_successfully"));
      } else {
        const result = await createChartAction({
          environmentId,
          chartInput: {
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

        setCurrentChartId(result.data.id);
        toast.success(t("environments.analysis.charts.chart_saved_successfully"));
      }

      setIsSaveDialogOpen(false);
      onOpenChange(false);
      router.refresh();
      onSuccess?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("environments.analysis.charts.failed_to_save_chart");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const cleanupOrphanChart = async (orphanChartId: string) => {
    await deleteChartAction({ environmentId, chartId: orphanChartId }).catch(() => {});
    setCurrentChartId(undefined);
  };

  /** Returns the chart ID to use (existing or newly created), or null on failure. */
  const ensureChartForDashboard = async (data: AnalyticsResponse): Promise<string | null> => {
    if (currentChartId) return currentChartId;

    const chartResult = await createChartAction({
      environmentId,
      chartInput: {
        name: chartName.trim(),
        type: data.chartType,
        query: data.query,
        config: {},
      },
    });

    if (!chartResult?.data) {
      toast.error(
        (chartResult && getFormattedErrorMessage(chartResult)) ||
          t("environments.analysis.charts.failed_to_save_chart")
      );
      return null;
    }

    setCurrentChartId(chartResult.data.id);
    return chartResult.data.id;
  };

  const handleAddToDashboard = async () => {
    if (!chartData || !selectedDashboardId) {
      toast.error(t("environments.analysis.charts.please_select_dashboard"));
      return;
    }

    if (!currentChartId && !chartName.trim()) {
      toast.error(t("environments.analysis.charts.please_enter_chart_name"));
      return;
    }

    setIsSaving(true);
    let newlyCreatedChartId: string | null = null;
    try {
      const chartIdToUse = await ensureChartForDashboard(chartData);
      if (!chartIdToUse) return;
      if (!currentChartId) newlyCreatedChartId = chartIdToUse;

      const widgetResult = await addChartToDashboardAction({
        environmentId,
        chartId: chartIdToUse,
        dashboardId: selectedDashboardId,
      });

      if (!widgetResult?.data) {
        toast.error(
          (widgetResult && getFormattedErrorMessage(widgetResult)) ||
            t("environments.analysis.charts.failed_to_add_chart_to_dashboard")
        );
        if (newlyCreatedChartId) await cleanupOrphanChart(newlyCreatedChartId);
        return;
      }

      toast.success(t("environments.analysis.charts.chart_added_to_dashboard"));
      setIsAddToDashboardDialogOpen(false);
      onOpenChange(false);
      router.refresh();
      onSuccess?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("environments.analysis.charts.failed_to_add_chart_to_dashboard");
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
      setSelectedChartType(undefined);
      setCurrentChartId(undefined);
      setChartLoadError(null);
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
    selectedChartType,
    initialQuery,
    setSelectedChartType,
    currentChartId,
    setCurrentChartId,
    isSaveDialogOpen,
    setIsSaveDialogOpen,
    isAddToDashboardDialogOpen,
    setIsAddToDashboardDialogOpen,
    dashboards,
    selectedDashboardId,
    setSelectedDashboardId,
    isSaving,
    isLoadingChart,
    chartLoadError,
    handleChartGenerated,
    handleSaveChart,
    handleAddToDashboard,
    handleClose,
    handleChartTypeChange,
  };
}
