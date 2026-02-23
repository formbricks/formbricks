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
import type { AnalyticsResponse, TApiChartType } from "@/modules/ee/analysis/types/analysis";

export interface UseCreateChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentId: string;
  chartId?: string;
  defaultDashboardId?: string;
  onSuccess?: () => void;
}

export function useCreateChartDialog({
  open,
  onOpenChange,
  environmentId,
  chartId,
  defaultDashboardId,
  onSuccess,
}: Readonly<UseCreateChartDialogProps>) {
  const { t } = useTranslation();
  const [selectedChartType, setSelectedChartType] = useState<string>("");
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
      setIsLoadingChart(true);
      getChartAction({ environmentId, chartId })
        .then(async (result) => {
          if (result?.data) {
            const chart = result.data;
            setChartName(chart.name);

            const queryResult = await executeQueryAction({
              environmentId,
              query: chart.query,
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
              const loadedChartData: AnalyticsResponse = {
                query: chart.query,
                chartType: mapDatabaseChartTypeToApi(chart.type),
                data: data,
              };

              setChartData(loadedChartData);
              setSelectedChartType(loadedChartData.chartType ?? "");
              setCurrentChartId(chart.id);
            } else {
              toast.error(t("environments.analysis.charts.no_data_returned_for_chart"));
            }
          } else if (result?.serverError) {
            toast.error(getFormattedErrorMessage(result));
          }
          setIsLoadingChart(false);
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : t("environments.analysis.charts.failed_to_load_chart");
          toast.error(message);
          setIsLoadingChart(false);
        });
    } else if (open && !chartId) {
      setChartData(null);
      setChartName("");
      setSelectedChartType("");
      setCurrentChartId(undefined);
    }
  }, [open, chartId, environmentId]);

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

  return {
    chartData,
    chartName,
    setChartName,
    selectedChartType,
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
