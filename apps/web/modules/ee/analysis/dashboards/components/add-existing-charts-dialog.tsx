"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getChartsAction } from "@/modules/ee/analysis/charts/actions";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
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
  existingChartIds: string[];
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
  dashboardId,
  existingChartIds,
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
          const availableCharts = result.data.filter((chart) => !existingChartIds.includes(chart.id));
          setChartOptions(availableCharts.map((chart) => ({ value: chart.id, label: chart.name })));
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
  }, [open, environmentId, existingChartIds, t]);

  const handleAdd = async () => {
    if (selectedChartIds.length === 0) return;

    setIsAdding(true);
    try {
      const results = await Promise.allSettled(
        selectedChartIds.map((chartId) => addChartToDashboardAction({ environmentId, chartId, dashboardId }))
      );

      const fulfilled = results.filter(
        (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof addChartToDashboardAction>>> =>
          r.status === "fulfilled"
      );
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      const successes = fulfilled.filter((r) => r.value?.data);
      const failures = fulfilled.filter((r) => !r.value?.data).length + rejected.length;

      if (failures > 0) {
        if (successes.length > 0) {
          toast.error(t("environments.analysis.dashboards.charts_add_partial_failure", { count: failures }));
        } else {
          toast.error(t("environments.analysis.dashboards.charts_add_failed"));
        }
      } else {
        toast.success(
          t("environments.analysis.dashboards.charts_added_to_dashboard", {
            count: selectedChartIds.length,
          })
        );
      }

      if (successes.length > 0) {
        onSuccess();
      }
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
          <DialogTitle>{t("common.add_charts")}</DialogTitle>
          <DialogDescription>{t("common.add_existing_chart_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {isLoading ? (
            <div className="flex items-center justify-center rounded-md border px-3 py-2">
              <Loader2Icon className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {chartOptions.length === 0 && (
                <Alert variant="info" className="mb-4">
                  <AlertTitle>{t("environments.analysis.dashboards.no_charts_to_add_message")}</AlertTitle>
                  <AlertDescription>
                    {t("environments.analysis.dashboards.no_charts_available_description")}
                  </AlertDescription>
                </Alert>
              )}
              <MultiSelect
                options={chartOptions}
                value={selectedChartIds}
                onChange={setSelectedChartIds}
                placeholder={t("common.search_charts")}
                disabled={chartOptions.length === 0}
              />
            </>
          )}
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
