"use client";

import { ChartDialogLoadingView } from "@/modules/ee/analysis/charts/components/chart-dialog-loading-view";
import { CreateChartView } from "@/modules/ee/analysis/charts/components/create-chart-view";
import { EditChartView } from "@/modules/ee/analysis/charts/components/edit-chart-view";
import { useCreateChartDialog } from "@/modules/ee/analysis/charts/hooks/use-create-chart-dialog";

export interface CreateChartDialogProps {
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
}: Readonly<CreateChartDialogProps>) {
  const hook = useCreateChartDialog({
    open,
    onOpenChange,
    environmentId,
    chartId,
    onSuccess,
  });

  const {
    chartData,
    chartName,
    setChartName,
    selectedChartType,
    setSelectedChartType,
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
  } = hook;

  if (chartId && isLoadingChart) {
    return <ChartDialogLoadingView open={open} onClose={handleClose} />;
  }

  if (chartId && chartData) {
    return (
      <EditChartView
        open={open}
        onClose={handleClose}
        environmentId={environmentId}
        chartData={chartData}
        chartName={chartName}
        onChartNameChange={setChartName}
        onChartGenerated={handleChartGenerated}
        onAdvancedBuilderSave={handleAdvancedBuilderSave}
        onAdvancedBuilderAddToDashboard={handleAdvancedBuilderAddToDashboard}
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
      shouldShowAdvancedBuilder={shouldShowAdvancedBuilder}
      onChartGenerated={handleChartGenerated}
      onAdvancedBuilderSave={handleAdvancedBuilderSave}
      onAdvancedBuilderAddToDashboard={handleAdvancedBuilderAddToDashboard}
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
