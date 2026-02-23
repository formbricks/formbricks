"use client";

import { PlusIcon, SaveIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AddToDashboardDialog } from "@/modules/ee/analysis/charts/components/add-to-dashboard-dialog";
import { SaveChartDialog } from "@/modules/ee/analysis/charts/components/save-chart-dialog";
import { Button } from "@/modules/ui/components/button";
import { DialogFooter } from "@/modules/ui/components/dialog";

interface ChartDialogFooterWithModalsProps {
  chartName: string;
  onChartNameChange: (name: string) => void;
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
  /** When provided (editing), Save runs this directly; otherwise Save opens name dialog */
  onDirectSave?: () => void;
}

export function ChartDialogFooterWithModals({
  chartName,
  onChartNameChange,
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
  onDirectSave,
}: Readonly<ChartDialogFooterWithModalsProps>) {
  const { t } = useTranslation();
  const handleSaveClick = () => {
    if (onDirectSave) {
      onDirectSave();
    } else {
      onSaveDialogOpenChange(true);
    }
  };

  return (
    <>
      <DialogFooter>
        <Button variant="outline" onClick={() => onAddToDashboardDialogOpenChange(true)} disabled={isSaving}>
          <PlusIcon className="mr-2 h-4 w-4" />
          {t("environments.analysis.charts.add_to_dashboard")}
        </Button>
        <Button onClick={handleSaveClick} disabled={isSaving}>
          <SaveIcon className="mr-2 h-4 w-4" />
          {t("environments.analysis.charts.save_chart")}
        </Button>
      </DialogFooter>

      <SaveChartDialog
        open={isSaveDialogOpen}
        onOpenChange={onSaveDialogOpenChange}
        chartName={chartName}
        onChartNameChange={onChartNameChange}
        onSave={onSave}
        isSaving={isSaving}
      />

      <AddToDashboardDialog
        open={isAddToDashboardDialogOpen}
        onOpenChange={onAddToDashboardDialogOpenChange}
        chartName={chartName}
        onChartNameChange={onChartNameChange}
        dashboards={dashboards}
        selectedDashboardId={selectedDashboardId}
        onDashboardSelect={onDashboardSelect}
        onAdd={onAddToDashboard}
        isSaving={isSaving}
      />
    </>
  );
}
