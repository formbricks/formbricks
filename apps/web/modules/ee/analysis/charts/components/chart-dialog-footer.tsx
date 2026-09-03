"use client";

import { PlusIcon, SaveIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { DialogFooter } from "@/modules/ui/components/dialog";

interface ChartDialogFooterProps {
  onSaveClick?: () => void;
  formId?: string;
  onAddToDashboardClick?: () => void;
  onCancelClick?: () => void;
  isSaving: boolean;
  isDisabled?: boolean;
  saveLabel?: string;
  showAddToDashboard?: boolean;
  /**
   * Whether there is anything to save yet. Save is disabled rather than removed: a footer that
   * grows a button halfway through configuring reads as broken, and a button that is there but
   * unavailable is what tells you the chart is not finished.
   */
  canSave?: boolean;
}

export function ChartDialogFooter({
  onSaveClick,
  formId,
  onAddToDashboardClick,
  onCancelClick,
  isSaving,
  isDisabled = false,
  saveLabel,
  showAddToDashboard = true,
  canSave = true,
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
          <PlusIcon />
          {t("workspace.analysis.charts.add_to_dashboard")}
        </Button>
      )}
      {onCancelClick && (
        <Button variant="secondary" type="button" onClick={onCancelClick} disabled={isSaving}>
          {t("common.cancel")}
        </Button>
      )}
      {/*
        No tooltip explaining why Save is unavailable: a tooltip on a disabled button never opens for
        a keyboard user and is not announced, and the preview says the same thing already — visibly,
        permanently, and in the place the eye is when there is nothing to save yet.
      */}
      <Button
        type={formId ? "submit" : "button"}
        form={formId}
        onClick={formId ? undefined : onSaveClick}
        disabled={isSaving || isDisabled || !canSave}>
        <SaveIcon />
        {saveLabel ?? t("workspace.analysis.charts.save_chart")}
      </Button>
    </DialogFooter>
  );
}
