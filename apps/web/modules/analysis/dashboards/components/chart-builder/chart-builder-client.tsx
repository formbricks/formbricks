"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { AnalyticsResponse } from "@/app/api/analytics/_lib/types";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import {
  addChartToDashboardAction,
  createChartAction,
  executeQueryAction,
  getChartAction,
  getDashboardsAction,
  updateChartAction,
} from "../../actions";
import { mapChartType, mapDatabaseChartTypeToApi } from "../../lib/chart-utils";
import { AddToDashboardDialog } from "./add-to-dashboard-dialog";
import { AIQuerySection } from "./ai-query-section";
import { ChartPreview } from "./chart-preview";
import { ConfigureChartDialog } from "./configure-chart-dialog";
import { ManualChartBuilder } from "./manual-chart-builder";
import { SaveChartDialog } from "./save-chart-dialog";

interface ChartBuilderClientProps {
  environmentId: string;
  chartId?: string;
}

export function ChartBuilderClient({ environmentId, chartId }: ChartBuilderClientProps) {
  const router = useRouter();
  const [selectedChartType, setSelectedChartType] = useState<string>("");
  const [chartData, setChartData] = useState<AnalyticsResponse | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isAddToDashboardDialogOpen, setIsAddToDashboardDialogOpen] = useState(false);
  const [isConfigureDialogOpen, setIsConfigureDialogOpen] = useState(false);
  const [chartName, setChartName] = useState("");
  const [dashboards, setDashboards] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const [configuredChartType, setConfiguredChartType] = useState<string | null>(null);

  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [currentChartId, setCurrentChartId] = useState<string | undefined>(chartId);

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
    if (chartId) {
      setIsLoadingChart(true);
      getChartAction({ environmentId, chartId })
        .then(async (result) => {
          if (result?.data) {
            const chart = result.data;
            setChartName(chart.name);

            // Execute the chart's query to get the data
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
              // Format as AnalyticsResponse
              const chartData: AnalyticsResponse = {
                query: chart.query as AnalyticsResponse["query"],
                chartType: mapDatabaseChartTypeToApi(chart.type),
                data: Array.isArray(queryResult.data.data) ? queryResult.data.data : [],
              };

              setChartData(chartData);
              setConfiguredChartType(mapDatabaseChartTypeToApi(chart.type));
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
          const errorMessage = error instanceof Error ? error.message : "Failed to load chart";
          toast.error(errorMessage);
          setIsLoadingChart(false);
        });
    }
  }, [chartId, environmentId]);

  const handleChartGenerated = (data: AnalyticsResponse) => {
    setChartData(data);
    setChartName(data.chartType ? `Chart ${new Date().toLocaleString()}` : "");
  };

  const handleSaveChart = async () => {
    if (!chartData || !chartName.trim()) {
      toast.error("Please enter a chart name");
      return;
    }

    setIsSaving(true);
    try {
      // If we have a currentChartId, update the existing chart; otherwise create a new one
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
        router.push(`/environments/${environmentId}/analysis/charts`);
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
        router.push(`/environments/${environmentId}/analysis/charts`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save chart";
      toast.error(errorMessage);
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

      // If we don't have a chartId (creating new chart), create it first
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

      // Add the chart (existing or newly created) to the dashboard
      const widgetResult = await addChartToDashboardAction({
        environmentId,
        chartId: chartIdToUse,
        dashboardId: selectedDashboardId,
      });

      if (!widgetResult?.data) {
        toast.error(widgetResult?.serverError || "Failed to add chart to dashboard");
        return;
      }

      toast.success("Chart added to dashboard!");
      setIsAddToDashboardDialogOpen(false);
      router.push(`/environments/${environmentId}/analysis/dashboards/${selectedDashboardId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add chart to dashboard";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // If loading an existing chart, show loading state
  if (chartId && isLoadingChart) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // If viewing an existing chart, show only the chart preview
  if (chartId && chartData) {
    return (
      <div className="grid gap-8">
        <ChartPreview chartData={chartData} />

        {/* Dialogs */}
        <SaveChartDialog
          open={isSaveDialogOpen}
          onOpenChange={setIsSaveDialogOpen}
          chartName={chartName}
          onChartNameChange={setChartName}
          onSave={handleSaveChart}
          isSaving={isSaving}
        />

        <AddToDashboardDialog
          open={isAddToDashboardDialogOpen}
          onOpenChange={setIsAddToDashboardDialogOpen}
          chartName={chartName}
          onChartNameChange={setChartName}
          dashboards={dashboards}
          selectedDashboardId={selectedDashboardId}
          onDashboardSelect={setSelectedDashboardId}
          onAdd={handleAddToDashboard}
          isSaving={isSaving}
        />

        <ConfigureChartDialog
          open={isConfigureDialogOpen}
          onOpenChange={setIsConfigureDialogOpen}
          currentChartType={chartData?.chartType || "bar"}
          configuredChartType={configuredChartType}
          onChartTypeSelect={setConfiguredChartType}
          onReset={() => setConfiguredChartType(null)}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      {/* Option 1: Ask AI */}
      <AIQuerySection onChartGenerated={handleChartGenerated} />

      {/* Chart Preview */}
      {chartData && <ChartPreview chartData={chartData} />}

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gray-50 px-2 text-sm text-gray-500">OR</span>
        </div>
      </div>

      {/* Option 2: Build Manually */}
      <ManualChartBuilder selectedChartType={selectedChartType} onChartTypeSelect={setSelectedChartType} />

      {/* Dialogs */}
      <SaveChartDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        chartName={chartName}
        onChartNameChange={setChartName}
        onSave={handleSaveChart}
        isSaving={isSaving}
      />

      <AddToDashboardDialog
        open={isAddToDashboardDialogOpen}
        onOpenChange={setIsAddToDashboardDialogOpen}
        chartName={chartName}
        onChartNameChange={setChartName}
        dashboards={dashboards}
        selectedDashboardId={selectedDashboardId}
        onDashboardSelect={setSelectedDashboardId}
        onAdd={handleAddToDashboard}
        isSaving={isSaving}
      />

      <ConfigureChartDialog
        open={isConfigureDialogOpen}
        onOpenChange={setIsConfigureDialogOpen}
        currentChartType={chartData?.chartType || "bar"}
        configuredChartType={configuredChartType}
        onChartTypeSelect={setConfiguredChartType}
        onReset={() => setConfiguredChartType(null)}
      />
    </div>
  );
}
