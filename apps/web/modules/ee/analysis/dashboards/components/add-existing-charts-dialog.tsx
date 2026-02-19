"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
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
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { getChartsAction } from "@/modules/ee/analysis/charts/actions";
import { addChartToDashboardAction } from "../actions";
import { TDashboard } from "../../types/analysis";

interface AddExistingChartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentId: string;
  dashboard: TDashboard;
  onSuccess: () => void;
}

interface ChartOption {
  value: string;
  label: string;
}

export function AddExistingChartsDialog({
  open,
  onOpenChange,
  environmentId,
  dashboard,
  onSuccess,
}: AddExistingChartsDialogProps) {
  const { t } = useTranslation();
  const [chartOptions, setChartOptions] = useState<ChartOption[]>([]);
  const [selectedChartIds, setSelectedChartIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const existingChartIds = useMemo(
    () => new Set(dashboard.widgets.filter((w) => w.chartId).map((w) => w.chartId!)),
    [dashboard.widgets]
  );

  useEffect(() => {
    if (!open) return;

    const loadCharts = async () => {
      setIsLoading(true);
      setSelectedChartIds([]);
      try {
        const result = await getChartsAction({ environmentId });
        if (result?.data) {
          setChartOptions(
            result.data.map((chart) => ({
              value: chart.id,
              label: existingChartIds.has(chart.id) ? `${chart.name} (already added)` : chart.name,
            }))
          );
        } else {
          toast.error(result?.serverError || "Failed to load charts");
        }
      } catch {
        toast.error("Failed to load charts");
      } finally {
        setIsLoading(false);
      }
    };

    loadCharts();
  }, [open, environmentId, existingChartIds]);

  const handleAdd = async () => {
    if (selectedChartIds.length === 0) return;

    setIsAdding(true);
    try {
      const results = await Promise.all(
        selectedChartIds.map((chartId) =>
          addChartToDashboardAction({
            environmentId,
            chartId,
            dashboardId: dashboard.id,
          })
        )
      );

      const failures = results.filter((r) => !r?.data);
      if (failures.length > 0) {
        toast.error(`Failed to add ${failures.length} chart(s)`);
      } else {
        toast.success(
          selectedChartIds.length === 1
            ? "Chart added to dashboard"
            : `${selectedChartIds.length} charts added to dashboard`
        );
      }

      onSuccess();
    } catch {
      toast.error("Failed to add charts to dashboard");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("common.add_existing_chart")}</DialogTitle>
          <DialogDescription>{t("common.add_existing_chart_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {isLoading ? (
            <div className="flex items-center justify-center rounded-md border px-3 py-2">
              <Loader2Icon className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : chartOptions.length === 0 ? (
            <div className="flex h-20 items-center justify-center">
              <p className="text-sm text-gray-500">
                No charts exist yet. Create one first using the + button.
              </p>
            </div>
          ) : (
            <MultiSelect
              options={chartOptions}
              value={selectedChartIds}
              onChange={setSelectedChartIds}
              placeholder={t("common.search_charts")}
            />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleAdd}
            loading={isAdding}
            disabled={selectedChartIds.length === 0 || isAdding}>
            {selectedChartIds.length > 0
              ? `Add ${selectedChartIds.length} chart${selectedChartIds.length > 1 ? "s" : ""}`
              : t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
