"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getChartTypes } from "@/modules/ee/analysis/charts/lib/chart-types";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";
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

interface ConfigureChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentChartType: TChartType;
  configuredChartType: TChartType | null;
  onChartTypeSelect: (type: TChartType) => void;
  onReset: () => void;
}

export function ConfigureChartDialog({
  open,
  onOpenChange,
  currentChartType,
  configuredChartType,
  onChartTypeSelect,
  onReset,
}: Readonly<ConfigureChartDialogProps>) {
  const { t } = useTranslation();
  const chartTypes = getChartTypes(t);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("workspace.analysis.charts.configure_title")}</DialogTitle>
          <DialogDescription>{t("workspace.analysis.charts.configure_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-6">
            <div>
              <h4 className="text-md mb-3 font-semibold text-gray-900">
                {t("workspace.analysis.charts.configure_type_label")}
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {chartTypes.map((chart) => {
                  const isSelected = (configuredChartType || currentChartType) === chart.id;
                  return (
                    <button
                      key={chart.id}
                      type="button"
                      onClick={() => onChartTypeSelect(chart.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border p-4 transition-all hover:bg-gray-50",
                        isSelected
                          ? "border-brand-dark bg-brand-dark/5 ring-2 ring-brand-dark"
                          : "border-gray-200"
                      )}
                      aria-label={chart.label}>
                      <div className="flex size-10 items-center justify-center rounded-sm bg-gray-100">
                        <chart.icon className="size-5 text-gray-600" strokeWidth={1.5} />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{chart.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onReset} className="text-sm">
                  {t("workspace.analysis.charts.reset_to_ai_suggestion")}
                </Button>
                {configuredChartType && (
                  <span className="text-sm text-gray-500">
                    {t("workspace.analysis.charts.original")}:{" "}
                    {chartTypes.find((c) => c.id === currentChartType)?.label ?? currentChartType}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{t("workspace.analysis.charts.apply_changes")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
