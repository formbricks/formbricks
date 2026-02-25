"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AddToDashboardDialog } from "@/modules/ee/analysis/charts/components/add-to-dashboard-dialog";
import { AdvancedChartBuilder } from "@/modules/ee/analysis/charts/components/advanced-chart-builder";
import { AIQuerySection } from "@/modules/ee/analysis/charts/components/ai-query-section";
import { ChartBuilderGuide } from "@/modules/ee/analysis/charts/components/chart-builder-guide";
import { ChartDialogFooter } from "@/modules/ee/analysis/charts/components/chart-dialog-footer";
import { ChartPreview } from "@/modules/ee/analysis/charts/components/chart-preview";
import { ManualChartBuilder } from "@/modules/ee/analysis/charts/components/manual-chart-builder";
import { SaveChartDialog } from "@/modules/ee/analysis/charts/components/save-chart-dialog";
import type { AnalyticsResponse, TChartType } from "@/modules/ee/analysis/types/analysis";
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
  onClose: () => void;
  environmentId: string;
  chartId?: string;
  chartData: AnalyticsResponse | null;
  chartName: string;
  onChartNameChange: (name: string) => void;
  selectedChartType?: TChartType;
  onSelectedChartTypeChange: (type: TChartType) => void;
  onChartGenerated: (data: AnalyticsResponse) => void;
  dashboards: Array<{ id: string; name: string }>;
  selectedDashboardId: string;
  onDashboardSelect: (id: string) => void;
  onAddToDashboard: () => void;
  onSave: () => void;
  isSaving: boolean;
  isSaveDialogOpen: boolean;
  onSaveDialogOpenChange: (open: boolean) => void;
  isAddToDashboardDialogOpen: boolean;
  onAddToDashboardDialogOpenChange: (open: boolean) => void;
}

export function CreateChartView({
  open,
  onClose,
  environmentId,
  chartId,
  chartData,
  chartName,
  onChartNameChange,
  selectedChartType,
  onSelectedChartTypeChange,
  onChartGenerated,
  dashboards,
  selectedDashboardId,
  onDashboardSelect,
  onAddToDashboard,
  onSave,
  isSaving,
  isSaveDialogOpen,
  onSaveDialogOpenChange,
  isAddToDashboardDialogOpen,
  onAddToDashboardDialogOpenChange,
}: Readonly<CreateChartViewProps>) {
  const { t } = useTranslation();
  const chartPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartData) {
      chartPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [chartData]);

  const handleAdvancedChartGenerated = (data: AnalyticsResponse) => {
    onChartGenerated(data);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" width="wide">
        <DialogHeader>
          <DialogTitle>
            {chartId
              ? t("environments.analysis.charts.edit_chart_title")
              : t("environments.analysis.charts.create_chart")}
          </DialogTitle>
          <DialogDescription>
            {chartId
              ? t("environments.analysis.charts.edit_chart_description")
              : t("environments.analysis.charts.create_chart_description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4">
            <AIQuerySection environmentId={environmentId} onChartGenerated={onChartGenerated} />

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gray-50 px-2 text-sm text-gray-500">
                  {t("environments.analysis.charts.OR")}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <ChartBuilderGuide />
              <ManualChartBuilder
                selectedChartType={selectedChartType}
                onChartTypeSelect={onSelectedChartTypeChange}
              />
            </div>

            {selectedChartType && (
              <AdvancedChartBuilder
                environmentId={environmentId}
                chartType={selectedChartType}
                initialQuery={chartData?.query}
                hidePreview={true}
                onChartGenerated={handleAdvancedChartGenerated}
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
              onSaveClick={() => onSaveDialogOpenChange(true)}
              onAddToDashboardClick={() => onAddToDashboardDialogOpenChange(true)}
              isSaving={isSaving}
            />
            <SaveChartDialog
              open={isSaveDialogOpen}
              onOpenChange={onSaveDialogOpenChange}
              chartName={chartName}
              onChartNameChange={onChartNameChange}
              onSave={onSave}
              isSaving={isSaving}
            />
            <AddToDashboardDialog
              isOpen={isAddToDashboardDialogOpen}
              onOpenChange={onAddToDashboardDialogOpenChange}
              chartName={chartName}
              onChartNameChange={onChartNameChange}
              dashboards={dashboards}
              selectedDashboardId={selectedDashboardId}
              onDashboardSelect={onDashboardSelect}
              onConfirm={onAddToDashboard}
              isSaving={isSaving}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
