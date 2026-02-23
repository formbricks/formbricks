"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { CHART_TYPES } from "@/modules/ee/analysis/charts/lib/chart-types";
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
  currentChartType: string;
  configuredChartType: string | null;
  onChartTypeSelect: (type: string) => void;
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
  const availableTypes = CHART_TYPES.filter((type) =>
    ["bar", "line", "area", "pie", "big_number"].includes(type.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("environments.analysis.charts.configure_title")}</DialogTitle>
          <DialogDescription>{t("environments.analysis.charts.configure_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-6">
            <div>
              <h4 className="mb-3 text-sm font-medium text-gray-900">
                {t("environments.analysis.charts.configure_type_label")}
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {availableTypes.map((chart) => {
                  const isSelected = (configuredChartType || currentChartType) === chart.id;
                  return (
                    <button
                      key={chart.id}
                      type="button"
                      onClick={() => onChartTypeSelect(chart.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border p-4 transition-all hover:bg-gray-50",
                        isSelected
                          ? "border-brand-dark bg-brand-dark/5 ring-brand-dark ring-2"
                          : "border-gray-200"
                      )}
                      aria-label={t(`environments.analysis.charts.chart_type_${chart.id}`)}>
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100">
                        <chart.icon className="h-5 w-5 text-gray-600" strokeWidth={1.5} />
                      </div>
                      <span className="text-xs font-medium text-gray-700">
                        {t(`environments.analysis.charts.chart_type_${chart.id}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onReset} className="text-xs">
                  {t("environments.analysis.charts.reset_to_ai_suggestion")}
                </Button>
                {configuredChartType && (
                  <span className="text-xs text-gray-500">
                    {t("environments.analysis.charts.original")}:{" "}
                    {t(`environments.analysis.charts.chart_type_${currentChartType}`, {
                      defaultValue:
                        CHART_TYPES.find((c) => c.id === currentChartType)?.name ?? currentChartType,
                    })}
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
          <Button onClick={() => onOpenChange(false)}>
            {t("environments.analysis.charts.apply_changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
