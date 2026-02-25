"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createChartAction, deleteChartAction } from "@/modules/ee/analysis/charts/actions";
import { resolveChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { addChartToDashboardAction, getDashboardsAction } from "@/modules/ee/analysis/dashboards/actions";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";

export interface ChartInput {
  query: TChartQuery;
  chartType: TChartType;
}

export interface UseSaveDashboardDialogsProps {
  environmentId: string;
  /** Returns current query and chart type when save/add is triggered; null if not ready */
  getChartInput: () => ChartInput | null;
  onSave?: (chartId: string) => void;
  onAddToDashboard?: (chartId: string, dashboardId: string) => void;
}

export function useSaveDashboardDialogs({
  environmentId,
  getChartInput,
  onSave,
  onAddToDashboard,
}: Readonly<UseSaveDashboardDialogsProps>) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isAddToDashboardDialogOpen, setIsAddToDashboardDialogOpen] = useState(false);
  const [chartName, setChartName] = useState("");
  const [dashboards, setDashboards] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isAddToDashboardDialogOpen) {
      getDashboardsAction({ environmentId }).then((result) => {
        if (result?.data) {
          setDashboards(result.data.map((d) => ({ id: d.id, name: d.name })));
        } else if (result?.serverError) {
          toast.error(getFormattedErrorMessage(result));
        }
      });
    }
  }, [isAddToDashboardDialogOpen, environmentId]);

  const handleSaveChart = async () => {
    const input = getChartInput();
    if (!input) return;
    if (!chartName.trim()) {
      toast.error(t("environments.analysis.charts.please_enter_chart_name"));
      return;
    }

    setIsSaving(true);
    try {
      const result = await createChartAction({
        environmentId,
        chartInput: {
          name: chartName.trim(),
          type: resolveChartType(input.chartType),
          query: input.query,
          config: {},
        },
      });

      if (!result?.data) {
        toast.error(
          (result && getFormattedErrorMessage(result)) ||
            t("environments.analysis.charts.failed_to_save_chart")
        );
        return;
      }

      toast.success(t("environments.analysis.charts.chart_saved_successfully"));
      setIsSaveDialogOpen(false);
      if (onSave) {
        onSave(result.data.id);
      } else {
        router.push(`/environments/${environmentId}/analysis/charts`);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("environments.analysis.charts.failed_to_save_chart");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToDashboard = async () => {
    const input = getChartInput();
    if (!input || !selectedDashboardId) {
      toast.error(t("environments.analysis.charts.please_select_dashboard"));
      return;
    }

    const name = chartName.trim() || `Chart ${new Date().toISOString().slice(0, 19)}`;

    setIsSaving(true);
    let chartId: string | null = null;
    try {
      const chartResult = await createChartAction({
        environmentId,
        chartInput: {
          name,
          type: resolveChartType(input.chartType),
          query: input.query,
          config: {},
        },
      });

      if (!chartResult?.data) {
        toast.error(
          (chartResult && getFormattedErrorMessage(chartResult)) ||
            t("environments.analysis.charts.failed_to_save_chart")
        );
        return;
      }
      chartId = chartResult.data.id;

      const widgetResult = await addChartToDashboardAction({
        environmentId,
        chartId,
        dashboardId: selectedDashboardId,
        title: name,
        layout: { x: 0, y: 0, w: 4, h: 3 },
      });

      if (!widgetResult?.data) {
        toast.error(
          (widgetResult && getFormattedErrorMessage(widgetResult)) ||
            t("environments.analysis.charts.failed_to_add_chart_to_dashboard")
        );
        await deleteChartAction({ environmentId, chartId }).catch(() => {
          /* best-effort cleanup of orphan chart */
        });
        return;
      }

      toast.success(t("environments.analysis.charts.chart_added_to_dashboard"));
      setIsAddToDashboardDialogOpen(false);
      if (onAddToDashboard) {
        onAddToDashboard(chartId, selectedDashboardId);
      } else {
        router.push(`/environments/${environmentId}/analysis/dashboards/${selectedDashboardId}`);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("environments.analysis.charts.failed_to_add_chart_to_dashboard");
      toast.error(message);
      if (chartId) {
        await deleteChartAction({ environmentId, chartId }).catch(() => {
          /* best-effort cleanup of orphan chart */
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaveDialogOpen,
    setIsSaveDialogOpen,
    isAddToDashboardDialogOpen,
    setIsAddToDashboardDialogOpen,
    chartName,
    setChartName,
    dashboards,
    selectedDashboardId,
    setSelectedDashboardId,
    isSaving,
    handleSaveChart,
    handleAddToDashboard,
  };
}
