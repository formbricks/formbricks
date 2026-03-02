"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";

interface SaveChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chartName: string;
  onChartNameChange: (name: string) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function SaveChartDialog({
  open,
  onOpenChange,
  chartName,
  onChartNameChange,
  onSave,
  isSaving,
}: Readonly<SaveChartDialogProps>) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("environments.analysis.charts.save_chart_dialog_title")}</DialogTitle>
          <DialogDescription>
            {t("environments.analysis.charts.enter_a_name_for_your_chart")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <label htmlFor="save-chart-name" className="sr-only">
            {t("environments.analysis.charts.chart_name")}
          </label>
          <Input
            placeholder={t("environments.analysis.charts.chart_name_placeholder")}
            value={chartName}
            onChange={(e) => onChartNameChange(e.target.value)}
            maxLength={255}
            onKeyDown={(e) => {
              if (e.key === "Enter" && chartName.trim() && !isSaving) {
                onSave();
              }
            }}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onSave} loading={isSaving} disabled={!chartName.trim()}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
