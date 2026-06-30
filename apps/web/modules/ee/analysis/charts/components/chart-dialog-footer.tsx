"use client";

import { PlusIcon, SaveIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { DialogFooter } from "@/modules/ui/components/dialog";

interface ChartDialogFooterProps {
  onSaveClick?: () => void;
  formId?: string;
  onAddToDashboardClick?: () => void;
  isSaving: boolean;
  isDisabled?: boolean;
  saveLabel?: string;
  showAddToDashboard?: boolean;
}

export function ChartDialogFooter({
  onSaveClick,
  formId,
  onAddToDashboardClick,
  isSaving,
  isDisabled = false,
  saveLabel,
  showAddToDashboard = true,
}: Readonly<ChartDialogFooterProps>) {
  const { t } = useTranslation();
  return (
    <DialogFooter>
      {showAddToDashboard && onAddToDashboardClick && (
        <Button
          variant="outline"
          type="button"
          onClick={onAddToDashboardClick}
          disabled={isSaving || isDisabled}>
          <PlusIcon className="mr-2 size-4" />
          {t("workspace.analysis.charts.add_to_dashboard")}
        </Button>
      )}
      <Button
        type={formId ? "submit" : "button"}
        form={formId}
        onClick={formId ? undefined : onSaveClick}
        disabled={isSaving || isDisabled}>
        <SaveIcon className="mr-2 size-4" />
        {saveLabel ?? t("workspace.analysis.charts.save_chart")}
      </Button>
    </DialogFooter>
  );
}
