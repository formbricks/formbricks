"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getChartsAction } from "@/modules/ee/analysis/charts/actions";
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
import { addChartToDashboardAction } from "../actions";

interface AddExistingChartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentId: string;
  dashboardId: string;
  onSuccess: () => void;
}

interface ChartOption {
  value: string;
  label: string;
}

function ChartSelector({
  isLoading,
  chartOptions,
  selectedChartIds,
  onSelectedChange,
}: Readonly<{
  isLoading: boolean;
  chartOptions: ChartOption[];
  selectedChartIds: string[];
  onSelectedChange: (ids: string[]) => void;
}>) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-md border px-3 py-2">
        <Loader2Icon className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (chartOptions.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center">
        <p className="text-sm text-gray-500">{t("environments.analysis.dashboards.no_charts_exist")}</p>
      </div>
    );
  }

  return (
    <MultiSelect
      options={chartOptions}
      value={selectedChartIds}
      onChange={onSelectedChange}
      placeholder={t("common.search_charts")}
    />
  );
}

export function AddExistingChartsDialog({
  open,
  onOpenChange,
  environmentId,
  dashboardId,
  onSuccess,
}: Readonly<AddExistingChartsDialogProps>) {
  const { t } = useTranslation();
  const [chartOptions, setChartOptions] = useState<ChartOption[]>([]);
  const [selectedChartIds, setSelectedChartIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!open) return;

    const loadCharts = async () => {
      setIsLoading(true);
      setSelectedChartIds([]);
      try {
        const result = await getChartsAction({ environmentId });
        if (result?.data) {
          setChartOptions(result.data.map((chart) => ({ value: chart.id, label: chart.name })));
        } else {
          toast.error(result?.serverError || t("environments.analysis.dashboards.charts_load_failed"));
        }
      } catch {
        toast.error(t("environments.analysis.dashboards.charts_load_failed"));
      } finally {
        setIsLoading(false);
      }
    };

    loadCharts();
  }, [open, environmentId, t]);

  const handleAdd = async () => {
    if (selectedChartIds.length === 0) return;

    setIsAdding(true);
    try {
      const results = await Promise.all(
        selectedChartIds.map((chartId) => addChartToDashboardAction({ environmentId, chartId, dashboardId }))
      );

      const failures = results.filter((r) => !r?.data);
      if (failures.length > 0) {
        toast.error(
          t("environments.analysis.dashboards.charts_add_partial_failure", { count: failures.length })
        );
      } else {
        toast.success(
          t("environments.analysis.dashboards.charts_added_to_dashboard", { count: selectedChartIds.length })
        );
      }

      onSuccess();
    } catch {
      toast.error(t("environments.analysis.dashboards.charts_add_failed"));
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
          <ChartSelector
            isLoading={isLoading}
            chartOptions={chartOptions}
            selectedChartIds={selectedChartIds}
            onSelectedChange={setSelectedChartIds}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleAdd} loading={isAdding} disabled={selectedChartIds.length === 0 || isAdding}>
            {selectedChartIds.length > 0
              ? t("environments.analysis.dashboards.add_count_charts", { count: selectedChartIds.length })
              : t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
