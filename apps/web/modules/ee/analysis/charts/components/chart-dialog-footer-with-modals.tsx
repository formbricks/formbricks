"use client";

import { PlusIcon, SaveIcon } from "lucide-react";
import { Button } from "@/modules/ui/components/button";
import { DialogFooter } from "@/modules/ui/components/dialog";
import { AddToDashboardDialog } from "./chart-builder/add-to-dashboard-dialog";
import { SaveChartDialog } from "./chart-builder/save-chart-dialog";

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
}: ChartDialogFooterWithModalsProps) {
  return (
    <>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onAddToDashboardDialogOpenChange(true)}
          disabled={isSaving}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add to Dashboard
        </Button>
        <Button onClick={() => onSaveDialogOpenChange(true)} disabled={isSaving}>
          <SaveIcon className="mr-2 h-4 w-4" />
          Save Chart
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
