"use client";

import { useTranslation } from "react-i18next";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/modules/ui/components/dialog";
import { AnalyticsResponse } from "@/app/api/analytics/_lib/types";
import { TCubeQuery } from "../../types/analysis";
import { AdvancedChartBuilder } from "./chart-builder/advanced-chart-builder";
import { ChartPreview } from "./chart-builder/chart-preview";
import { ChartDialogFooterWithModals } from "./chart-dialog-footer-with-modals";

interface EditChartViewProps {
  open: boolean;
  onClose: () => void;
  environmentId: string;
  chartData: AnalyticsResponse;
  chartName: string;
  onChartNameChange: (name: string) => void;
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
  chartName,
  onChartNameChange,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle>{t("environments.analysis.charts.edit_chart_title")}</DialogTitle>
          <DialogDescription>{t("environments.analysis.charts.edit_chart_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 px-1">
            <AdvancedChartBuilder
              environmentId={environmentId}
              initialChartType={chartData.chartType || ""}
              initialQuery={chartData.query as TCubeQuery | undefined}
              hidePreview={true}
              onChartGenerated={onChartGenerated}
              onSave={onAdvancedBuilderSave}
              onAddToDashboard={onAdvancedBuilderAddToDashboard}
            />
            <ChartPreview chartData={chartData} />
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
        />
      </DialogContent>
    </Dialog>
  );
}
