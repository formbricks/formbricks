"use client";

import { ChartDialogLoadingView } from "@/modules/ee/analysis/charts/components/chart-dialog-loading-view";
import { CreateChartView } from "@/modules/ee/analysis/charts/components/create-chart-view";
import { EditChartView } from "@/modules/ee/analysis/charts/components/edit-chart-view";
import { useCreateChartDialog } from "@/modules/ee/analysis/charts/hooks/use-create-chart-dialog";
import { DEFAULT_CHART_TYPE } from "@/modules/ee/analysis/charts/lib/chart-types";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

export interface CreateChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentId: string;
  chartId?: string;
  /** Pre-loaded chart metadata from list; skips getChartAction when provided */
  initialChart?: TChartWithCreator;
  onSuccess?: () => void;
}

export function CreateChartDialog({
  open,
  onOpenChange,
  environmentId,
  chartId,
  initialChart,
  onSuccess,
}: Readonly<CreateChartDialogProps>) {
  const hook = useCreateChartDialog({
    open,
    onOpenChange,
    environmentId,
    chartId,
    initialChart,
    onSuccess,
  });

  const {
    chartData,
    chartName,
    setChartName,
    selectedChartType,
    initialQuery,
    setSelectedChartType,
    handleChartTypeChange,
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
  } = hook;

  if (chartId && isLoadingChart && !initialChart) {
    return <ChartDialogLoadingView open={open} onClose={handleClose} />;
  }

  if (chartId && (chartData || initialChart)) {
    return (
      <EditChartView
        open={open}
        onClose={handleClose}
        environmentId={environmentId}
        chartData={chartData ?? null}
        initialQuery={initialQuery}
        isLoadingChart={isLoadingChart}
        chartLoadError={chartLoadError}
        chartName={chartName}
        onChartNameChange={setChartName}
        selectedChartType={selectedChartType ?? DEFAULT_CHART_TYPE}
        onChartTypeChange={handleChartTypeChange}
        onChartGenerated={handleChartGenerated}
        dashboards={dashboards}
        selectedDashboardId={selectedDashboardId}
        onDashboardSelect={setSelectedDashboardId}
        onAddToDashboard={handleAddToDashboard}
        onSave={handleSaveChart}
        isSaving={isSaving}
        isAddToDashboardDialogOpen={isAddToDashboardDialogOpen}
        onAddToDashboardDialogOpenChange={setIsAddToDashboardDialogOpen}
      />
    );
  }

  return (
    <CreateChartView
      open={open}
      onClose={handleClose}
      environmentId={environmentId}
      chartId={chartId}
      chartData={chartData}
      chartName={chartName}
      onChartNameChange={setChartName}
      selectedChartType={selectedChartType}
      onSelectedChartTypeChange={setSelectedChartType}
      onChartGenerated={handleChartGenerated}
      dashboards={dashboards}
      selectedDashboardId={selectedDashboardId}
      onDashboardSelect={setSelectedDashboardId}
      onAddToDashboard={handleAddToDashboard}
      onSave={handleSaveChart}
      isSaving={isSaving}
      isSaveDialogOpen={isSaveDialogOpen}
      onSaveDialogOpenChange={setIsSaveDialogOpen}
      isAddToDashboardDialogOpen={isAddToDashboardDialogOpen}
      onAddToDashboardDialogOpenChange={setIsAddToDashboardDialogOpen}
    />
  );
}
