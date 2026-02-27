"use client";

import { useTranslation } from "react-i18next";
import { AddToDashboardDialog } from "@/modules/ee/analysis/charts/components/add-to-dashboard-dialog";
import { AdvancedChartBuilder } from "@/modules/ee/analysis/charts/components/advanced-chart-builder";
import { ChartBuilderGuide } from "@/modules/ee/analysis/charts/components/chart-builder-guide";
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

interface EditChartViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentId: string;
  chartId: string;
  initialChart?: TChartWithCreator;
  onSuccess?: () => void;
}

export function EditChartView({
  open,
  onOpenChange,
  environmentId,
  chartId,
  initialChart,
  onSuccess,
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
    handleClose,
  } = useChartDialog({ open, onOpenChange, environmentId, chartId, initialChart, onSuccess });

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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" width="wide">
        <DialogHeader>
          <DialogTitle>{t("environments.analysis.charts.edit_chart_title")}</DialogTitle>
          <DialogDescription>{t("environments.analysis.charts.edit_chart_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 px-1">
            <div className="space-y-2">
              <label htmlFor="edit-chart-name" className="text-sm">
                {t("environments.analysis.charts.chart_name")}
              </label>
              <Input
                id="edit-chart-name"
                value={chartName}
                onChange={(e) => setChartName(e.target.value)}
                placeholder={t("environments.analysis.charts.chart_name_placeholder")}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <ChartBuilderGuide />
              <ManualChartBuilder selectedChartType={chartType} onChartTypeSelect={handleChartTypeChange} />
            </div>
            <AdvancedChartBuilder
              environmentId={environmentId}
              chartType={chartType}
              initialQuery={chartData?.query ?? initialQuery}
              hidePreview={true}
              onChartGenerated={handleChartGenerated}
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
