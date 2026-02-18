"use client";

import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/modules/ui/components/dialog";
import { AnalyticsResponse } from "@/app/api/analytics/_lib/types";
import { TCubeQuery } from "../../types/analysis";
import { AdvancedChartBuilder } from "./chart-builder/advanced-chart-builder";
import { AIQuerySection } from "./chart-builder/ai-query-section";
import { ChartPreview } from "./chart-builder/chart-preview";
import { ManualChartBuilder } from "./chart-builder/manual-chart-builder";
import { ChartDialogFooterWithModals } from "./chart-dialog-footer-with-modals";

interface CreateChartViewProps {
  open: boolean;
  onClose: () => void;
  environmentId: string;
  chartId?: string;
  chartData: AnalyticsResponse | null;
  chartName: string;
  onChartNameChange: (name: string) => void;
  selectedChartType: string;
  onSelectedChartTypeChange: (type: string) => void;
  shouldShowAdvancedBuilder: boolean;
  onChartGenerated: (data: AnalyticsResponse) => void;
  onAdvancedBuilderSave: (savedChartId: string) => void;
  onAdvancedBuilderAddToDashboard: (savedChartId: string, _dashboardId?: string) => void;
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
  shouldShowAdvancedBuilder,
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
}: Readonly<CreateChartViewProps>) {
  const handleAdvancedChartGenerated = (data: AnalyticsResponse) => {
    onChartGenerated(data);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
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
            <AIQuerySection onChartGenerated={onChartGenerated} />

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
              onChartTypeSelect={onSelectedChartTypeChange}
            />

            {shouldShowAdvancedBuilder && (
              <AdvancedChartBuilder
                environmentId={environmentId}
                initialChartType={selectedChartType || chartData?.chartType || ""}
                initialQuery={chartData?.query as TCubeQuery | undefined}
                hidePreview={true}
                onChartGenerated={handleAdvancedChartGenerated}
                onSave={onAdvancedBuilderSave}
                onAddToDashboard={onAdvancedBuilderAddToDashboard}
              />
            )}

            {chartData && <ChartPreview chartData={chartData} />}
          </div>
        </DialogBody>

        {chartData && (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
