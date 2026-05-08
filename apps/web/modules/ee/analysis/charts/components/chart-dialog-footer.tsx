"use client";

import { PlusIcon, SaveIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { DialogFooter } from "@/modules/ui/components/dialog";

interface ChartDialogFooterProps {
  onSaveClick: () => void;
  onAddToDashboardClick?: () => void;
  isSaving: boolean;
  saveLabel?: string;
  showAddToDashboard?: boolean;
}

export function ChartDialogFooter({
  onSaveClick,
  onAddToDashboardClick,
  isSaving,
  saveLabel,
  showAddToDashboard = true,
}: Readonly<ChartDialogFooterProps>) {
  const { t } = useTranslation();
  return (
    <DialogFooter>
      {showAddToDashboard && onAddToDashboardClick && (
        <Button variant="outline" onClick={onAddToDashboardClick} disabled={isSaving}>
          <PlusIcon className="mr-2 h-4 w-4" />
          {t("workspace.analysis.charts.add_to_dashboard")}
        </Button>
      )}
      <Button onClick={onSaveClick} disabled={isSaving}>
        <SaveIcon className="mr-2 h-4 w-4" />
        {saveLabel ?? t("workspace.analysis.charts.save_chart")}
      </Button>
    </DialogFooter>
  );
}
