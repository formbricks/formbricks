"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AnalyticsResponse } from "@/app/api/analytics/_lib/types";
import {
  createChartAction,
  executeQueryAction,
  getChartAction,
  updateChartAction,
} from "../actions";
import { addChartToDashboardAction, getDashboardsAction } from "@/modules/ee/analysis/dashboards/actions";
import { mapChartType, mapDatabaseChartTypeToApi } from "../lib/chart-utils";

export interface UseCreateChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentId: string;
  chartId?: string;
  onSuccess?: () => void;
}

export function useCreateChartDialog({
  open,
  onOpenChange,
  environmentId,
  chartId,
  onSuccess,
}: UseCreateChartDialogProps) {
  const [selectedChartType, setSelectedChartType] = useState<string>("");
  const [chartData, setChartData] = useState<AnalyticsResponse | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isAddToDashboardDialogOpen, setIsAddToDashboardDialogOpen] = useState(false);
  const [chartName, setChartName] = useState("");
  const [dashboards, setDashboards] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [currentChartId, setCurrentChartId] = useState<string | undefined>(chartId);

  const shouldShowAdvancedBuilder = !!selectedChartType || !!chartData;

  useEffect(() => {
    if (isAddToDashboardDialogOpen) {
      getDashboardsAction({ environmentId }).then((result) => {
        if (result?.data) {
          setDashboards(result.data);
        } else if (result?.serverError) {
          toast.error(result.serverError);
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
              query: chart.query as AnalyticsResponse["query"],
            });

            if (queryResult?.data?.error || queryResult?.serverError) {
              toast.error(queryResult.data?.error || queryResult.serverError || "Failed to load chart data");
              setIsLoadingChart(false);
              return;
            }

            if (queryResult?.data?.data) {
              const loadedChartData: AnalyticsResponse = {
                query: chart.query as AnalyticsResponse["query"],
                chartType: mapDatabaseChartTypeToApi(chart.type),
                data: Array.isArray(queryResult.data.data) ? queryResult.data.data : [],
              };

              setChartData(loadedChartData);
              setCurrentChartId(chart.id);
            } else {
              toast.error("No data returned for chart");
            }
          } else if (result?.serverError) {
            toast.error(result.serverError);
          }
          setIsLoadingChart(false);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Failed to load chart";
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
    setChartName(data.chartType ? `Chart ${new Date().toLocaleString()}` : "");
    if (data.chartType) {
      setSelectedChartType(data.chartType);
    }
  };

  const handleSaveChart = async () => {
    if (!chartData || !chartName.trim()) {
      toast.error("Please enter a chart name");
      return;
    }

    setIsSaving(true);
    try {
      if (currentChartId) {
        const result = await updateChartAction({
          environmentId,
          chartId: currentChartId,
          name: chartName.trim(),
          type: mapChartType(chartData.chartType),
          query: chartData.query,
          config: {},
        });

        if (!result?.data) {
          toast.error(result?.serverError || "Failed to update chart");
          return;
        }

        toast.success("Chart updated successfully!");
        setIsSaveDialogOpen(false);
        onOpenChange(false);
        onSuccess?.();
      } else {
        const result = await createChartAction({
          environmentId,
          name: chartName.trim(),
          type: mapChartType(chartData.chartType),
          query: chartData.query,
          config: {},
        });

        if (!result?.data) {
          toast.error(result?.serverError || "Failed to save chart");
          return;
        }

        setCurrentChartId(result.data.id);
        toast.success("Chart saved successfully!");
        setIsSaveDialogOpen(false);
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save chart";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToDashboard = async () => {
    if (!chartData || !selectedDashboardId) {
      toast.error("Please select a dashboard");
      return;
    }

    setIsSaving(true);
    try {
      let chartIdToUse = currentChartId;

      if (!chartIdToUse) {
        if (!chartName.trim()) {
          toast.error("Please enter a chart name");
          setIsSaving(false);
          return;
        }

        const chartResult = await createChartAction({
          environmentId,
          name: chartName.trim(),
          type: mapChartType(chartData.chartType),
          query: chartData.query,
          config: {},
        });

        if (!chartResult?.data) {
          toast.error(chartResult?.serverError || "Failed to save chart");
          setIsSaving(false);
          return;
        }

        chartIdToUse = chartResult.data.id;
        setCurrentChartId(chartIdToUse);
      }

      const widgetResult = await addChartToDashboardAction({
        environmentId,
        chartId: chartIdToUse,
        dashboardId: selectedDashboardId,
        title: chartName.trim(),
        layout: { x: 0, y: 0, w: 4, h: 3 },
      });

      if (!widgetResult?.data) {
        toast.error(widgetResult?.serverError || "Failed to add chart to dashboard");
        return;
      }

      toast.success("Chart added to dashboard!");
      setIsAddToDashboardDialogOpen(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add chart to dashboard";
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

  const handleAdvancedBuilderAddToDashboard = (savedChartId: string, _dashboardId?: string) => {
    setCurrentChartId(savedChartId);
    setIsAddToDashboardDialogOpen(false);
    onOpenChange(false);
    onSuccess?.();
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
  };
}
