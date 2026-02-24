"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  createChartAction,
  executeQueryAction,
  getChartAction,
  updateChartAction,
} from "@/modules/ee/analysis/charts/actions";
import { mapChartType, mapDatabaseChartTypeToApi } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { addChartToDashboardAction, getDashboardsAction } from "@/modules/ee/analysis/dashboards/actions";
import type {
  AnalyticsResponse,
  TApiChartType,
  TChartWithCreator,
} from "@/modules/ee/analysis/types/analysis";

export interface UseCreateChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentId: string;
  chartId?: string;
  /** Pre-loaded chart metadata; when provided for edit, skips getChartAction */
  initialChart?: TChartWithCreator;
  defaultDashboardId?: string;
  onSuccess?: () => void;
}

export function useCreateChartDialog({
  open,
  onOpenChange,
  environmentId,
  chartId,
  initialChart,
  defaultDashboardId,
  onSuccess,
}: Readonly<UseCreateChartDialogProps>) {
  const { t } = useTranslation();
  const [selectedChartType, setSelectedChartType] = useState<TApiChartType | "">("");
  const [chartData, setChartData] = useState<AnalyticsResponse | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isAddToDashboardDialogOpen, setIsAddToDashboardDialogOpen] = useState(false);
  const [chartName, setChartName] = useState("");
  const [dashboards, setDashboards] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>(defaultDashboardId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [currentChartId, setCurrentChartId] = useState<string | undefined>(chartId);
  const router = useRouter();
  const shouldShowAdvancedBuilder = !!selectedChartType || !!chartData;

  useEffect(() => {
    if (isAddToDashboardDialogOpen) {
      getDashboardsAction({ environmentId }).then((result) => {
        if (result?.data) {
          setDashboards(result.data.map((d) => ({ id: d.id, name: d.name })));
        } else if (result?.serverError) {
          toast.error(getFormattedErrorMessage(result));
        }
      });
    }
  }, [isAddToDashboardDialogOpen, environmentId]);

  useEffect(() => {
    if (open && chartId) {
      const chartMetadata = initialChart?.id === chartId ? initialChart : undefined;

      if (chartMetadata) {
        setChartName(chartMetadata.name);
        setSelectedChartType(mapDatabaseChartTypeToApi(chartMetadata.type));
        setCurrentChartId(chartMetadata.id);
      }

      setIsLoadingChart(true);

      const loadChartData = async (query: TChartWithCreator["query"], chartType: string) => {
        const queryResult = await executeQueryAction({
          environmentId,
          query,
        });

        if (queryResult?.serverError) {
          toast.error(
            getFormattedErrorMessage(queryResult) ||
              t("environments.analysis.charts.failed_to_load_chart_data")
          );
          setIsLoadingChart(false);
          return;
        }

        const data = Array.isArray(queryResult?.data) ? queryResult.data : undefined;
        if (data) {
          setChartData({
            query,
            chartType: mapDatabaseChartTypeToApi(chartType),
            data,
          });
        } else {
          toast.error(t("environments.analysis.charts.no_data_returned_for_chart"));
        }
        setIsLoadingChart(false);
      };

      if (chartMetadata) {
        loadChartData(chartMetadata.query, chartMetadata.type);
      } else {
        getChartAction({ environmentId, chartId })
          .then(async (result) => {
            if (result?.data) {
              const chart = result.data;
              setChartName(chart.name);
              setSelectedChartType(mapDatabaseChartTypeToApi(chart.type));
              setCurrentChartId(chart.id);
              await loadChartData(chart.query, chart.type);
            } else if (result?.serverError) {
              toast.error(getFormattedErrorMessage(result));
              setIsLoadingChart(false);
            }
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : t("environments.analysis.charts.failed_to_load_chart");
            toast.error(message);
            setIsLoadingChart(false);
          });
      }
    } else if (open && !chartId) {
      setChartData(null);
      setChartName("");
      setSelectedChartType("");
      setCurrentChartId(undefined);
    }
  }, [open, chartId, environmentId, initialChart]);

  const handleChartGenerated = (data: AnalyticsResponse) => {
    setChartData(data);
    if (!currentChartId) {
      setChartName(data.chartType ? `Chart ${new Date().toLocaleString()}` : "");
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
            type: mapChartType(chartData.chartType),
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
        setIsSaveDialogOpen(false);
        onOpenChange(false);
        onSuccess?.();
      } else {
        const result = await createChartAction({
          environmentId,
          chartInput: {
            name: chartName.trim(),
            type: mapChartType(chartData.chartType),
            query: chartData.query,
            config: {},
          },
        });

        if (result?.data) {
          setCurrentChartId(result.data.id);
          toast.success(t("environments.analysis.charts.chart_saved_successfully"));
          setIsSaveDialogOpen(false);
          onOpenChange(false);
          router.refresh();
        } else {
          const errorMessage = getFormattedErrorMessage(result);
          toast.error(errorMessage);
        }
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("environments.analysis.charts.failed_to_save_chart");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToDashboard = async () => {
    if (!chartData || !selectedDashboardId) {
      toast.error(t("environments.analysis.charts.please_select_dashboard"));
      return;
    }

    setIsSaving(true);
    try {
      let chartIdToUse = currentChartId;

      if (!chartIdToUse) {
        if (!chartName.trim()) {
          toast.error(t("environments.analysis.charts.please_enter_chart_name"));
          setIsSaving(false);
          return;
        }

        const chartResult = await createChartAction({
          environmentId,
          chartInput: {
            name: chartName.trim(),
            type: mapChartType(chartData.chartType),
            query: chartData.query,
            config: {},
          },
        });

        if (!chartResult?.data) {
          toast.error(
            (chartResult && getFormattedErrorMessage(chartResult)) ||
              t("environments.analysis.charts.failed_to_save_chart")
          );
          setIsSaving(false);
          return;
        }

        chartIdToUse = chartResult.data.id;
        setCurrentChartId(chartResult.data.id);
      }

      const widgetResult = await addChartToDashboardAction({
        environmentId,
        chartId: chartIdToUse,
        dashboardId: selectedDashboardId,
        title: chartName.trim(),
        layout: { x: 0, y: 0, w: 4, h: 3 },
      });

      if (!widgetResult?.data) {
        toast.error(
          (widgetResult && getFormattedErrorMessage(widgetResult)) ||
            t("environments.analysis.charts.failed_to_add_chart_to_dashboard")
        );
        return;
      }

      toast.success(t("environments.analysis.charts.chart_added_to_dashboard"));
      setIsAddToDashboardDialogOpen(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("environments.analysis.charts.failed_to_add_chart_to_dashboard");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setChartData(null);
      setChartName("");
      setSelectedChartType("");
      setCurrentChartId(undefined);
      onOpenChange(false);
    }
  };

  const handleAdvancedBuilderSave = (savedChartId: string) => {
    setCurrentChartId(savedChartId);
    setIsSaveDialogOpen(false);
    onOpenChange(false);
    onSuccess?.();
  };

  const handleAdvancedBuilderAddToDashboard = (savedChartId: string) => {
    setCurrentChartId(savedChartId);
    setIsAddToDashboardDialogOpen(false);
    onOpenChange(false);
    onSuccess?.();
  };

  const handleChartTypeChange = (type: TApiChartType) => {
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
    shouldShowAdvancedBuilder,
    handleChartGenerated,
    handleSaveChart,
    handleAddToDashboard,
    handleClose,
    handleAdvancedBuilderSave,
    handleAdvancedBuilderAddToDashboard,
    handleChartTypeChange,
  };
}
