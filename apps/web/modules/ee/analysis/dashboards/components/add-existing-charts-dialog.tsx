"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getChartsAction } from "@/modules/ee/analysis/charts/actions";
import { CreateChartButton } from "@/modules/ee/analysis/charts/components/create-chart-button";
import type { TAIUnavailableReason } from "@/modules/ee/analysis/charts/lib/ai-availability";
import { addChartToDashboardAction } from "@/modules/ee/analysis/dashboards/actions";
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
import { Label } from "@/modules/ui/components/label";
import { MultiSelect } from "@/modules/ui/components/multi-select";

interface AddExistingChartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  dashboardId: string;
  directories: { id: string; name: string }[];
  existingChartIds: string[];
  onSuccess: () => void;
  isAIAvailable?: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

interface ChartOption {
  value: string;
  label: string;
}

export function AddExistingChartsDialog({
  open,
  onOpenChange,
  workspaceId,
  dashboardId,
  directories,
  existingChartIds,
  onSuccess,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<AddExistingChartsDialogProps>) {
  const { t } = useTranslation();
  const router = useRouter();
  const [chartOptions, setChartOptions] = useState<ChartOption[]>([]);
  const [selectedChartIds, setSelectedChartIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const existingChartIdsRef = useRef(existingChartIds);
  existingChartIdsRef.current = existingChartIds;

  const loadCharts = useCallback(async () => {
    setIsLoading(true);
    setSelectedChartIds([]);
    try {
      const result = await getChartsAction({ workspaceId });
      if (result?.data) {
        const availableCharts = result.data.filter(
          (chart) => !existingChartIdsRef.current.includes(chart.id)
        );
        setChartOptions(availableCharts.map((chart) => ({ value: chart.id, label: chart.name })));
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage);
      }
    } catch {
      toast.error(t("workspace.analysis.dashboards.charts_load_failed"));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, t]);

  useEffect(() => {
    if (!open) return;
    loadCharts();
  }, [open, loadCharts]);

  const handleAdd = async () => {
    if (selectedChartIds.length === 0) return;

    const chartIdsToAdd = Array.from(new Set(selectedChartIds)).filter(
      (chartId) => !existingChartIdsRef.current.includes(chartId)
    );

    if (chartIdsToAdd.length === 0) {
      setSelectedChartIds([]);
      return;
    }

    setIsAdding(true);
    try {
      const results = await Promise.allSettled(
        chartIdsToAdd.map((chartId) => addChartToDashboardAction({ workspaceId, chartId, dashboardId }))
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
          toast.error(t("workspace.analysis.dashboards.charts_add_partial_failure", { count: failures }));
        } else {
          toast.error(t("workspace.analysis.dashboards.charts_add_failed"));
        }
      } else {
        toast.success(
          t("workspace.analysis.dashboards.charts_added_to_dashboard", {
            count: chartIdsToAdd.length,
          })
        );
      }

      if (successes.length > 0) {
        onSuccess();
      }
    } catch {
      toast.error(t("workspace.analysis.dashboards.charts_add_failed"));
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
        <DialogBody className="p-1">
          {isLoading ? (
            <div className="flex items-center justify-center rounded-md border px-3 py-2">
              <Loader2Icon className="size-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t("common.add_chart")}</Label>
              <MultiSelect
                options={chartOptions}
                value={selectedChartIds}
                onChange={setSelectedChartIds}
                placeholder={t("common.search_charts")}
                disabled={chartOptions.length === 0}
              />
            </div>
          )}
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          <CreateChartButton
            workspaceId={workspaceId}
            directories={directories}
            autoAddToDashboardId={dashboardId}
            label={t("workspace.analysis.dashboards.create_new_chart")}
            onSuccess={() => {
              onOpenChange(false);
              router.refresh();
              onSuccess();
            }}
            buttonProps={{ variant: "secondary", size: "default", disabled: isAdding }}
            isAIAvailable={isAIAvailable}
            aiUnavailableReason={aiUnavailableReason}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleAdd}
              loading={isAdding}
              disabled={selectedChartIds.length === 0 || isAdding}>
              {selectedChartIds.length > 0
                ? t("workspace.analysis.dashboards.add_count_charts", { count: selectedChartIds.length })
                : t("common.add")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
