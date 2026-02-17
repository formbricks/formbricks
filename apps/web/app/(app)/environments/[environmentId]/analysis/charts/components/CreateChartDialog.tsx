"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { AnalyticsResponse } from "@/app/api/analytics/_lib/types";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import {
  addChartToDashboardAction,
  createChartAction,
  executeQueryAction,
  getChartAction,
  getDashboardsAction,
  updateChartAction,
} from "../../actions";
import { PlusIcon, SaveIcon } from "lucide-react";
import { Button } from "@/modules/ui/components/button";
import { mapChartType, mapDatabaseChartTypeToApi } from "../../chart-builder/lib/chart-utils";
import { AIQuerySection } from "../../chart-builder/components/AIQuerySection";
import { AddToDashboardDialog } from "../../chart-builder/components/AddToDashboardDialog";
import { AdvancedChartBuilder } from "../../chart-builder/components/AdvancedChartBuilder";
import { ChartPreview } from "../../chart-builder/components/ChartPreview";
import { ManualChartBuilder } from "../../chart-builder/components/ManualChartBuilder";
import { SaveChartDialog } from "../../chart-builder/components/SaveChartDialog";

interface CreateChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentId: string;
  chartId?: string;
  onSuccess?: () => void;
}

export function CreateChartDialog({
  open,
  onOpenChange,
  environmentId,
  chartId,
  onSuccess,
}: CreateChartDialogProps) {
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

  // Determine if we should show AdvancedChartBuilder
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

            // Execute the chart's query to get the data
            const queryResult = await executeQueryAction({
              environmentId,
              query: chart.query as any,
            });

            if (queryResult?.data?.error || queryResult?.serverError) {
              toast.error(queryResult.data?.error || queryResult.serverError || "Failed to load chart data");
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
              setCurrentChartId(chart.id);
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
    } else if (open && !chartId) {
      // Reset state for new chart
      setChartData(null);
      setChartName("");
      setSelectedChartType("");
      setCurrentChartId(undefined);
    }
  }, [open, chartId, environmentId]);

  const handleChartGenerated = (data: AnalyticsResponse) => {
    setChartData(data);
    setChartName(data.chartType ? `Chart ${new Date().toLocaleString()}` : "");
    // Set chart type so AdvancedChartBuilder shows with the AI-generated chart type
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
    } catch (error: any) {
      toast.error(error.message || "Failed to add chart to dashboard");
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

  // If loading an existing chart, show loading state
  if (chartId && isLoadingChart) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-[90vw] max-h-[90vh] overflow-y-auto">
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // If viewing an existing chart, show only the chart preview
  if (chartId && chartData) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Chart</DialogTitle>
            <DialogDescription>View and edit your chart configuration.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ChartPreview chartData={chartData} />
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddToDashboardDialogOpen(true)} disabled={isSaving}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add to Dashboard
            </Button>
            <Button onClick={() => setIsSaveDialogOpen(true)} disabled={isSaving}>
              <SaveIcon className="mr-2 h-4 w-4" />
              Save Chart
            </Button>
          </DialogFooter>

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

        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" width="wide">
        <DialogHeader>
          <DialogTitle>{chartId ? "Edit Chart" : "Create Chart"}</DialogTitle>
          <DialogDescription>
            {chartId
              ? "View and edit your chart configuration."
              : "Use AI to generate a chart or build one manually."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4">
            {/* AI Query Section */}
            <AIQuerySection onChartGenerated={handleChartGenerated} />

            {/* OR Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gray-50 px-2 text-sm text-gray-500">OR</span>
              </div>
            </div>

            {/* Chart Type Selection */}
            <ManualChartBuilder
              selectedChartType={selectedChartType}
              onChartTypeSelect={setSelectedChartType}
            />

            {/* Advanced Builder - shown when chart type selected OR AI chart generated */}
            {shouldShowAdvancedBuilder && (
              <AdvancedChartBuilder
                environmentId={environmentId}
                initialChartType={selectedChartType || chartData?.chartType || ""}
                initialQuery={chartData?.query}
                hidePreview={true}
                onChartGenerated={(data) => {
                  setChartData(data);
                  setChartName(data.chartType ? `Chart ${new Date().toLocaleString()}` : "");
                  // Update selectedChartType when chart type changes in AdvancedChartBuilder
                  if (data.chartType) {
                    setSelectedChartType(data.chartType);
                  }
                }}
                onSave={(savedChartId) => {
                  setCurrentChartId(savedChartId);
                  setIsSaveDialogOpen(false);
                  onOpenChange(false);
                  onSuccess?.();
                }}
                onAddToDashboard={(savedChartId, _dashboardId) => {
                  setCurrentChartId(savedChartId);
                  setIsAddToDashboardDialogOpen(false);
                  onOpenChange(false);
                  onSuccess?.();
                }}
              />
            )}

            {/* Single Chart Preview - shown when chartData exists */}
            {chartData && <ChartPreview chartData={chartData} />}
          </div>
        </DialogBody>

        {chartData && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddToDashboardDialogOpen(true)} disabled={isSaving}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add to Dashboard
            </Button>
            <Button onClick={() => setIsSaveDialogOpen(true)} disabled={isSaving}>
              <SaveIcon className="mr-2 h-4 w-4" />
              Save Chart
            </Button>
          </DialogFooter>
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

      </DialogContent>
    </Dialog>
  );
}
