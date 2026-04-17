"use client";

import { useTranslation } from "react-i18next";
import { AddToDashboardDialog } from "@/modules/ee/analysis/charts/components/add-to-dashboard-dialog";
import { AdvancedChartBuilder } from "@/modules/ee/analysis/charts/components/advanced-chart-builder";
import { ChartDialogFooter } from "@/modules/ee/analysis/charts/components/chart-dialog-footer";
import { ChartDialogLoadingView } from "@/modules/ee/analysis/charts/components/chart-dialog-loading-view";
import { ChartPreview } from "@/modules/ee/analysis/charts/components/chart-preview";
import { ManualChartBuilder } from "@/modules/ee/analysis/charts/components/manual-chart-builder";
import { useChartDialog } from "@/modules/ee/analysis/charts/hooks/use-chart-dialog";
import { DEFAULT_CHART_TYPE } from "@/modules/ee/analysis/charts/lib/chart-types";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface EditChartViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  chartId: string;
  initialChart?: TChartWithCreator;
  onSuccess?: () => void;
  directories: { id: string; name: string }[];
}

export function EditChartView({
  open,
  onOpenChange,
  workspaceId,
  chartId,
  initialChart,
  onSuccess,
  directories,
}: Readonly<EditChartViewProps>) {
  const { t } = useTranslation();

  const {
    chartData,
    initialQuery,
    isLoadingChart,
    chartLoadError,
    chartName,
    setChartName,
    selectedChartType,
    handleChartTypeChange,
    handleChartGenerated,
    dashboards,
    selectedDashboardId,
    setSelectedDashboardId,
    handleAddToDashboard,
    handleSaveChart,
    isSaving,
    isAddToDashboardDialogOpen,
    setIsAddToDashboardDialogOpen,
    selectedDirectoryId,
    handleClose,
  } = useChartDialog({ open, onOpenChange, workspaceId, chartId, initialChart, onSuccess, directories });

  if (isLoadingChart && !initialChart) {
    return <ChartDialogLoadingView open={open} onClose={handleClose} />;
  }

  if (!isLoadingChart && !chartData && !initialChart && chartLoadError) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DialogContent width="wide">
          <DialogHeader>
            <DialogTitle>{t("common.error")}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <p className="text-sm text-red-600">{chartLoadError}</p>
              <Button variant="outline" onClick={handleClose}>
                {t("common.close")}
              </Button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    );
  }

  const chartType = selectedChartType ?? DEFAULT_CHART_TYPE;
  const directoryName = directories.find((d) => d.id === selectedDirectoryId)?.name;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" width="wide">
        <DialogHeader>
          <DialogTitle>{t("workspace.analysis.charts.edit_chart_title")}</DialogTitle>
          <DialogDescription>{t("workspace.analysis.charts.edit_chart_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 px-1">
            <div className="space-y-2">
              <label htmlFor="edit-chart-name" className="text-sm">
                {t("workspace.analysis.charts.chart_name")}
              </label>
              <Input
                id="edit-chart-name"
                value={chartName}
                onChange={(e) => setChartName(e.target.value)}
                placeholder={t("workspace.analysis.charts.chart_name_placeholder")}
                className="w-full"
              />
            </div>
            {directoryName && (
              <div className="space-y-2">
                <Label>{t("workspace.analysis.charts.data_source")}</Label>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  {directoryName}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <ManualChartBuilder selectedChartType={chartType} onChartTypeSelect={handleChartTypeChange} />
            </div>
            <AdvancedChartBuilder
              workspaceId={workspaceId}
              chartType={chartType}
              initialQuery={chartData?.query ?? initialQuery}
              hidePreview={true}
              onChartGenerated={handleChartGenerated}
              feedbackRecordDirectoryId={selectedDirectoryId}
            />
            <ChartPreview chartData={chartData} isLoading={isLoadingChart} error={chartLoadError} />
          </div>
        </DialogBody>
        <ChartDialogFooter
          onSaveClick={handleSaveChart}
          onAddToDashboardClick={() => setIsAddToDashboardDialogOpen(true)}
          isSaving={isSaving}
        />
        <AddToDashboardDialog
          isOpen={isAddToDashboardDialogOpen}
          onOpenChange={setIsAddToDashboardDialogOpen}
          chartName={chartName}
          onChartNameChange={setChartName}
          dashboards={dashboards}
          selectedDashboardId={selectedDashboardId}
          onDashboardSelect={setSelectedDashboardId}
          onConfirm={handleAddToDashboard}
          isSaving={isSaving}
        />
      </DialogContent>
    </Dialog>
  );
}
