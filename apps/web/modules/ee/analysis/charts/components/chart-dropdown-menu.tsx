"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CopyIcon, MoreVertical, PlusIcon, SquarePenIcon, TrashIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { AddToDashboardDialog } from "@/modules/ee/analysis/charts/components/add-to-dashboard-dialog";
import { DeleteChartDialog } from "@/modules/ee/analysis/charts/components/delete-chart-dialog";
import { useDashboardOptions } from "@/modules/ee/analysis/dashboards/hooks/use-dashboard-options";
import {
  type TAppChart,
  addDashboardWidget,
  chartInUseDashboards,
  deleteChart,
  duplicateChart,
  getChartApiErrorMessage,
} from "@/modules/ee/analysis/lib/api-client";
import { chartKeys, dashboardKeys } from "@/modules/ee/analysis/lib/query";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface ChartDropdownMenuProps {
  workspaceId: string;
  chart: TAppChart;
  onEdit?: () => void;
}

export function ChartDropdownMenu({ workspaceId, chart, onEdit }: Readonly<ChartDropdownMenuProps>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // The dashboards a delete was refused for, when the list's copy of the chart was out of date.
  const [refusedOnDashboards, setRefusedOnDashboards] = useState<{ id: string; name: string }[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const [isAddToDashboardDialogOpen, setIsAddToDashboardDialogOpen] = useState(false);
  const [isAddingToDashboard, setIsAddingToDashboard] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>();
  const dashboardOptions = useDashboardOptions({ workspaceId, enabled: isAddToDashboardDialogOpen });
  // Whether a dashboard already holds this chart comes from the chart itself, not another read.
  const dashboards = useMemo(
    () =>
      (dashboardOptions.data ?? []).map((dashboard) => ({
        ...dashboard,
        containsChart: chart.dashboards.some((holder) => holder.id === dashboard.id),
      })),
    [dashboardOptions.data, chart.dashboards]
  );

  useEffect(() => {
    if (dashboardOptions.error) {
      toast.error(
        getChartApiErrorMessage(
          dashboardOptions.error,
          t("workspace.analysis.charts.failed_to_load_dashboards")
        )
      );
    }
  }, [dashboardOptions.error, t]);

  const handleDeleteChart = async () => {
    setIsDeleting(true);
    try {
      await deleteChart(chart.id);
      toast.success(t("workspace.analysis.charts.chart_deleted_successfully"));
      setIsDeleteDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: chartKeys.all });
    } catch (error) {
      // Someone put the chart on a dashboard after this list was read: show where, as for any chart in use.
      const holders = chartInUseDashboards(error);
      if (holders) {
        setRefusedOnDashboards(holders);
        void queryClient.invalidateQueries({ queryKey: chartKeys.lists() });
      } else {
        toast.error(getChartApiErrorMessage(error, t("workspace.analysis.charts.chart_deletion_error")));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicateChart = async () => {
    setIsDuplicating(true);
    try {
      await duplicateChart(chart.id);
      toast.success(t("workspace.analysis.charts.chart_duplicated_successfully"));
      void queryClient.invalidateQueries({ queryKey: chartKeys.all });
    } catch (error) {
      toast.error(getChartApiErrorMessage(error, t("workspace.analysis.charts.chart_duplication_error")));
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleAddChartToDashboard = async () => {
    if (!selectedDashboardId) {
      toast.error(t("workspace.analysis.charts.please_select_dashboard"));
      return;
    }

    setIsAddingToDashboard(true);

    try {
      await addDashboardWidget(selectedDashboardId, { chartId: chart.id });
      toast.success(t("workspace.analysis.charts.chart_added_to_dashboard"));
      setIsAddToDashboardDialogOpen(false);
      setSelectedDashboardId(undefined);
      void queryClient.invalidateQueries({ queryKey: chartKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    } catch (error) {
      toast.error(
        getChartApiErrorMessage(error, t("workspace.analysis.charts.failed_to_add_chart_to_dashboard"))
      );
    } finally {
      setIsAddingToDashboard(false);
    }
  };

  return (
    <div id={`chart-${chart.id}-actions`} data-testid="chart-dropdown-menu">
      <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
        <DropdownMenuTrigger className="z-10" asChild>
          <Button variant="outline" className="px-2" onClick={(e) => e.stopPropagation()}>
            <span className="sr-only">{t("workspace.analysis.charts.open_options")}</span>
            <MoreVertical className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max" align="end">
          <DropdownMenuGroup>
            {onEdit && (
              <DropdownMenuItem
                icon={<SquarePenIcon className="size-4" />}
                onClick={() => {
                  setIsDropDownOpen(false);
                  onEdit();
                }}>
                {t("common.edit")}
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              icon={<CopyIcon className="size-4" />}
              onClick={() => {
                setIsDropDownOpen(false);
                handleDuplicateChart();
              }}
              disabled={isDuplicating}>
              {t("common.duplicate")}
            </DropdownMenuItem>

            <DropdownMenuItem
              icon={<PlusIcon className="size-4" />}
              onClick={() => {
                setIsDropDownOpen(false);
                setIsAddToDashboardDialogOpen(true);
              }}>
              {t("workspace.analysis.charts.add_to_dashboard")}
            </DropdownMenuItem>

            <DropdownMenuItem
              icon={<TrashIcon className="size-4" />}
              onClick={() => {
                setIsDropDownOpen(false);
                setIsDeleteDialogOpen(true);
              }}
              disabled={isDeleting}>
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteChartDialog
        open={isDeleteDialogOpen}
        setOpen={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setRefusedOnDashboards(null);
        }}
        workspaceId={workspaceId}
        dashboards={refusedOnDashboards ?? chart.dashboards}
        isDeleting={isDeleting}
        onDelete={handleDeleteChart}
      />
      <AddToDashboardDialog
        isOpen={isAddToDashboardDialogOpen}
        onOpenChange={(open) => {
          setIsAddToDashboardDialogOpen(open);
          if (!open) {
            setSelectedDashboardId(undefined);
          }
        }}
        chartName={chart.name}
        onChartNameChange={() => {}}
        dashboards={dashboards}
        selectedDashboardId={selectedDashboardId}
        onDashboardSelect={setSelectedDashboardId}
        onConfirm={handleAddChartToDashboard}
        isSaving={isAddingToDashboard}
        showChartNameField={false}
      />
    </div>
  );
}
