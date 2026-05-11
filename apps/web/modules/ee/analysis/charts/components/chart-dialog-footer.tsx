"use client";

import { PlusIcon, SaveIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { DialogFooter } from "@/modules/ui/components/dialog";

interface ChartDialogFooterProps {
  /** Pass either an explicit click handler for a non-form Save button… */
  onSaveClick?: () => void;
  /** …or a form id to make Save submit that form (preferred, so native HTML validation runs). */
  formId?: string;
  onAddToDashboardClick?: () => void;
  isSaving: boolean;
  saveLabel?: string;
  showAddToDashboard?: boolean;
}

export function ChartDialogFooter({
  onSaveClick,
  formId,
  onAddToDashboardClick,
  isSaving,
  saveLabel,
  showAddToDashboard = true,
}: Readonly<ChartDialogFooterProps>) {
  const { t } = useTranslation();
  return (
    <DialogFooter>
      {showAddToDashboard && onAddToDashboardClick && (
        <Button variant="outline" type="button" onClick={onAddToDashboardClick} disabled={isSaving}>
          <PlusIcon className="mr-2 h-4 w-4" />
          {t("workspace.analysis.charts.add_to_dashboard")}
        </Button>
      )}
      <Button
        type={formId ? "submit" : "button"}
        form={formId}
        onClick={formId ? undefined : onSaveClick}
        disabled={isSaving}>
        <SaveIcon className="mr-2 h-4 w-4" />
        {saveLabel ?? t("workspace.analysis.charts.save_chart")}
      </Button>
    </DialogFooter>
  );
}
