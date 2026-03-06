"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AddToDashboardDialog } from "@/modules/ee/analysis/charts/components/add-to-dashboard-dialog";
import { AdvancedChartBuilder } from "@/modules/ee/analysis/charts/components/advanced-chart-builder";
import { AIQuerySection } from "@/modules/ee/analysis/charts/components/ai-query-section";
import { ChartDialogFooter } from "@/modules/ee/analysis/charts/components/chart-dialog-footer";
import { ChartPreview } from "@/modules/ee/analysis/charts/components/chart-preview";
import { ManualChartBuilder } from "@/modules/ee/analysis/charts/components/manual-chart-builder";
import { SaveChartDialog } from "@/modules/ee/analysis/charts/components/save-chart-dialog";
import { useChartDialog } from "@/modules/ee/analysis/charts/hooks/use-chart-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface CreateChartViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentId: string;
  onSuccess?: () => void;
}

export function CreateChartView({
  open,
  onOpenChange,
  environmentId,
  onSuccess,
}: Readonly<CreateChartViewProps>) {
  const { t } = useTranslation();

  const {
    chartData,
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
    isSaveDialogOpen,
    setIsSaveDialogOpen,
    isAddToDashboardDialogOpen,
    setIsAddToDashboardDialogOpen,
    handleClose,
  } = useChartDialog({ open, onOpenChange, environmentId, onSuccess });

  const chartPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartData) {
      chartPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [chartData]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" width="wide" disableCloseOnOutsideClick>
        <DialogHeader>
          <DialogTitle>{t("environments.analysis.charts.create_chart")}</DialogTitle>
          <DialogDescription>{t("environments.analysis.charts.create_chart_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4">
            <AIQuerySection environmentId={environmentId} onChartGenerated={handleChartGenerated} />

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-sm text-gray-500">
                  {t("environments.analysis.charts.OR")}
                </span>
              </div>
            </div>

            <ManualChartBuilder
              selectedChartType={selectedChartType}
              onChartTypeSelect={handleChartTypeChange}
            />

            {selectedChartType && (
              <AdvancedChartBuilder
                environmentId={environmentId}
                chartType={selectedChartType}
                initialQuery={chartData?.query}
                hidePreview={true}
                onChartGenerated={handleChartGenerated}
              />
            )}

            {chartData && (
              <div ref={chartPreviewRef}>
                <ChartPreview chartData={chartData} />
              </div>
            )}
          </div>
        </DialogBody>

        {chartData && (
          <>
            <ChartDialogFooter
              onSaveClick={() => setIsSaveDialogOpen(true)}
              onAddToDashboardClick={() => setIsAddToDashboardDialogOpen(true)}
              isSaving={isSaving}
            />
            <SaveChartDialog
              open={isSaveDialogOpen}
              onOpenChange={setIsSaveDialogOpen}
              chartName={chartName}
              onChartNameChange={setChartName}
              onSave={handleSaveChart}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
