"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { createChartAction, addChartToDashboardAction, getDashboardsAction, getChartAction, executeQueryAction } from "../../actions";
import { AnalyticsResponse } from "@/app/api/analytics/_lib/types";
import { mapChartType, mapDatabaseChartTypeToApi } from "../lib/chart-utils";
import { AIQuerySection } from "./AIQuerySection";
import { ManualChartBuilder } from "./ManualChartBuilder";
import { AdvancedChartBuilder } from "./AdvancedChartBuilder";
import { ChartPreview } from "./ChartPreview";
import { SaveChartDialog } from "./SaveChartDialog";
import { AddToDashboardDialog } from "./AddToDashboardDialog";
import { ConfigureChartDialog } from "./ConfigureChartDialog";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

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
  const [showQuery, setShowQuery] = useState(false);
  const [showData, setShowData] = useState(false);
  const [configuredChartType, setConfiguredChartType] = useState<string | null>(null);
  const [showAdvancedBuilder, setShowAdvancedBuilder] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

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
              query: chart.query as any,
            });

            if (queryResult?.error || queryResult?.serverError) {
              toast.error(queryResult.error || queryResult.serverError || "Failed to load chart data");
              setIsLoadingChart(false);
              return;
            }

            if (queryResult?.data?.data) {
              // Format as AnalyticsResponse
              const chartData: AnalyticsResponse = {
                query: chart.query as any,
                chartType: mapDatabaseChartTypeToApi(chart.type),
                data: Array.isArray(queryResult.data.data) ? queryResult.data.data : [],
              };

              setChartData(chartData);
              setConfiguredChartType(mapDatabaseChartTypeToApi(chart.type));
            } else {
              toast.error("No data returned for chart");
            }
          } else if (result?.serverError) {
            toast.error(result.serverError);
          }
          setIsLoadingChart(false);
        })
        .catch((error: any) => {
          toast.error(error.message || "Failed to load chart");
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
      const result = await createChartAction({
        environmentId,
        name: chartName,
        type: mapChartType(chartData.chartType),
        query: chartData.query,
        config: {},
      });

      if (!result?.data) {
        toast.error(result?.serverError || "Failed to save chart");
        return;
      }

      toast.success("Chart saved successfully!");
      setIsSaveDialogOpen(false);
      router.push(`/environments/${environmentId}/analysis/charts`);
    } catch (error: any) {
      toast.error(error.message || "Failed to save chart");
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
      const chartResult = await createChartAction({
        environmentId,
        name: chartName || `Chart ${new Date().toLocaleString()}`,
        type: mapChartType(chartData.chartType),
        query: chartData.query,
        config: {},
      });

      if (!chartResult?.data) {
        toast.error(chartResult?.serverError || "Failed to save chart");
        return;
      }

      const widgetResult = await addChartToDashboardAction({
        environmentId,
        chartId: chartResult.data.id,
        dashboardId: selectedDashboardId,
      });

      if (!widgetResult?.data) {
        toast.error(widgetResult?.serverError || "Failed to add chart to dashboard");
        return;
      }

      toast.success("Chart added to dashboard!");
      setIsAddToDashboardDialogOpen(false);
      router.push(`/environments/${environmentId}/analysis/dashboard/${selectedDashboardId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to add chart to dashboard");
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualCreate = () => {
    if (!selectedChartType) {
      toast.error("Please select a chart type first");
      return;
    }
    setShowAdvancedBuilder(true);
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
        <ChartPreview
          chartData={chartData}
          configuredChartType={configuredChartType}
          showQuery={showQuery}
          showData={showData}
          isSaving={isSaving}
          onToggleQuery={() => setShowQuery(!showQuery)}
          onToggleData={() => setShowData(!showData)}
          onConfigure={() => setIsConfigureDialogOpen(true)}
          onSave={() => setIsSaveDialogOpen(true)}
          onAddToDashboard={() => setIsAddToDashboardDialogOpen(true)}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      {/* Option 1: Ask AI */}
      <AIQuerySection onChartGenerated={handleChartGenerated} />

      {/* Chart Preview */}
      {chartData && (
        <ChartPreview
          chartData={chartData}
          configuredChartType={configuredChartType}
          showQuery={showQuery}
          showData={showData}
          isSaving={isSaving}
          onToggleQuery={() => setShowQuery(!showQuery)}
          onToggleData={() => setShowData(!showData)}
          onConfigure={() => setIsConfigureDialogOpen(true)}
          onSave={() => setIsSaveDialogOpen(true)}
          onAddToDashboard={() => setIsAddToDashboardDialogOpen(true)}
        />
      )}

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gray-50 px-2 text-sm text-gray-500">OR</span>
        </div>
      </div>

      {/* Option 2: Build Manually */}
      {showAdvancedBuilder ? (
        <AdvancedChartBuilder environmentId={environmentId} initialChartType={selectedChartType} />
      ) : (
        <ManualChartBuilder
          selectedChartType={selectedChartType}
          onChartTypeSelect={setSelectedChartType}
          onCreate={handleManualCreate}
        />
      )}

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
