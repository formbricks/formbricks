"use client";

import { useTranslation } from "react-i18next";
import { AdvancedChartBuilder } from "@/modules/ee/analysis/charts/components/advanced-chart-builder";
import { ChartDialogFooterWithModals } from "@/modules/ee/analysis/charts/components/chart-dialog-footer-with-modals";
import { ChartPreview } from "@/modules/ee/analysis/charts/components/chart-preview";
import { ManualChartBuilder } from "@/modules/ee/analysis/charts/components/manual-chart-builder";
import type { AnalyticsResponse, TChartType } from "@/modules/ee/analysis/types/analysis";
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
  onClose: () => void;
  environmentId: string;
  chartData: AnalyticsResponse | null;
  /** Query from initialChart when chartData is still loading */
  initialQuery?: AnalyticsResponse["query"];
  isLoadingChart?: boolean;
  chartName: string;
  onChartNameChange: (name: string) => void;
  selectedChartType: TChartType | "";
  onChartTypeChange: (type: TChartType) => void;
  onChartGenerated: (data: AnalyticsResponse) => void;
  onAdvancedBuilderSave: (savedChartId: string) => void;
  onAdvancedBuilderAddToDashboard: (savedChartId: string, dashboardId?: string) => void;
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

export function EditChartView({
  open,
  onClose,
  environmentId,
  chartData,
  initialQuery,
  isLoadingChart = false,
  chartName,
  onChartNameChange,
  selectedChartType,
  onChartTypeChange,
  onChartGenerated,
  onAdvancedBuilderSave,
  onAdvancedBuilderAddToDashboard,
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
}: Readonly<EditChartViewProps>) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" width="wide">
        <DialogHeader>
          <DialogTitle>{t("environments.analysis.charts.edit_chart_title")}</DialogTitle>
          <DialogDescription>{t("environments.analysis.charts.edit_chart_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 px-1">
            <div className="space-y-2">
              <label htmlFor="edit-chart-name" className="text-sm font-medium text-gray-900">
                {t("environments.analysis.charts.chart_name")}
              </label>
              <Input
                id="edit-chart-name"
                value={chartName}
                onChange={(e) => onChartNameChange(e.target.value)}
                placeholder={t("environments.analysis.charts.chart_name_placeholder")}
                className="w-full"
              />
            </div>
            <ManualChartBuilder selectedChartType={selectedChartType} onChartTypeSelect={onChartTypeChange} />
            <AdvancedChartBuilder
              environmentId={environmentId}
              initialChartType={selectedChartType || chartData?.chartType}
              initialQuery={chartData?.query ?? initialQuery}
              hidePreview={true}
              onChartGenerated={onChartGenerated}
              onSave={onAdvancedBuilderSave}
              onAddToDashboard={onAdvancedBuilderAddToDashboard}
            />
            <ChartPreview chartData={chartData} isLoading={isLoadingChart} />
          </div>
        </DialogBody>
        <ChartDialogFooterWithModals
          chartName={chartName}
          onChartNameChange={onChartNameChange}
          dashboards={dashboards}
          selectedDashboardId={selectedDashboardId}
          onDashboardSelect={onDashboardSelect}
          onAddToDashboard={onAddToDashboard}
          onSave={onSave}
          isSaving={isSaving}
          isSaveDialogOpen={isSaveDialogOpen}
          onSaveDialogOpenChange={onSaveDialogOpenChange}
          isAddToDashboardDialogOpen={isAddToDashboardDialogOpen}
          onAddToDashboardDialogOpenChange={onAddToDashboardDialogOpenChange}
          onDirectSave={onSave}
        />
      </DialogContent>
    </Dialog>
  );
}
