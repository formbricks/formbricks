"use client";

import { PlusIcon, SaveIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { AnalyticsResponse } from "@/app/api/analytics/_lib/types";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import {
  addChartToDashboardAction,
  createChartAction,
  executeQueryAction,
  getChartAction,
  getDashboardsAction,
  updateChartAction,
} from "../actions";
import { mapChartType, mapDatabaseChartTypeToApi } from "../lib/chart-utils";
import { TCubeQuery } from "../types/analysis";
import { AddToDashboardDialog } from "./chart-builder/add-to-dashboard-dialog";
import { AdvancedChartBuilder } from "./chart-builder/advanced-chart-builder";
import { AIQuerySection } from "./chart-builder/ai-query-section";
import { ChartPreview } from "./chart-builder/chart-preview";
import { ManualChartBuilder } from "./chart-builder/manual-chart-builder";
import { SaveChartDialog } from "./chart-builder/save-chart-dialog";

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

  if (chartId && chartData) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-7xl">
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
            <AIQuerySection onChartGenerated={handleChartGenerated} />

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gray-50 px-2 text-sm text-gray-500">OR</span>
              </div>
            </div>

            <ManualChartBuilder
              selectedChartType={selectedChartType}
              onChartTypeSelect={setSelectedChartType}
            />

            {shouldShowAdvancedBuilder && (
              <AdvancedChartBuilder
                environmentId={environmentId}
                initialChartType={selectedChartType || chartData?.chartType || ""}
                initialQuery={chartData?.query as TCubeQuery | undefined}
                hidePreview={true}
                onChartGenerated={(data) => {
                  setChartData(data);
                  setChartName(data.chartType ? `Chart ${new Date().toLocaleString()}` : "");
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
                onAddToDashboard={(savedChartId) => {
                  setCurrentChartId(savedChartId);
                  setIsAddToDashboardDialogOpen(false);
                  onOpenChange(false);
                  onSuccess?.();
                }}
              />
            )}

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
