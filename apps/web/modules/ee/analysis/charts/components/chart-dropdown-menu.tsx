"use client";

import { CopyIcon, MoreVertical, PlusIcon, SquarePenIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { deleteChartAction, duplicateChartAction } from "@/modules/ee/analysis/charts/actions";
import { AddToDashboardDialog } from "@/modules/ee/analysis/charts/components/add-to-dashboard-dialog";
import { addChartToDashboardAction, getDashboardsAction } from "@/modules/ee/analysis/dashboards/actions";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface ChartDropdownMenuProps {
  workspaceId: string;
  chart: TChartWithCreator;
  onEdit?: () => void;
}

export function ChartDropdownMenu({ workspaceId, chart, onEdit }: Readonly<ChartDropdownMenuProps>) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const [isAddToDashboardDialogOpen, setIsAddToDashboardDialogOpen] = useState(false);
  const [isAddingToDashboard, setIsAddingToDashboard] = useState(false);
  const [dashboards, setDashboards] = useState<Array<{ id: string; name: string; containsChart?: boolean }>>(
    []
  );
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    if (!isAddToDashboardDialogOpen) {
      return () => {
        cancelled = true;
      };
    }

    void getDashboardsAction({ workspaceId, chartId: chart.id })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result?.data) {
          setDashboards(
            result.data.map((dashboard) => ({
              id: dashboard.id,
              name: dashboard.name,
              containsChart: dashboard.containsChart,
            }))
          );
        } else {
          toast.error(getFormattedErrorMessage(result));
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : t("workspace.analysis.charts.failed_to_load_dashboards");
        toast.error(message);
      });

    return () => {
      cancelled = true;
    };
  }, [isAddToDashboardDialogOpen, workspaceId, chart.id]);

  const handleDeleteChart = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteChartAction({ workspaceId, chartId: chart.id });
      if (result?.data) {
        toast.success(t("workspace.analysis.charts.chart_deleted_successfully"));
        setIsDeleteDialogOpen(false);
        router.refresh();
      } else {
        const msg = getFormattedErrorMessage(result) || t("workspace.analysis.charts.chart_deletion_error");
        toast.error(msg);
      }
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicateChart = async () => {
    setIsDuplicating(true);
    try {
      const result = await duplicateChartAction({ workspaceId, chartId: chart.id });
      if (result?.data) {
        toast.success(t("workspace.analysis.charts.chart_duplicated_successfully"));
        router.refresh();
      } else {
        toast.error(
          getFormattedErrorMessage(result) || t("workspace.analysis.charts.chart_duplication_error")
        );
      }
    } catch {
      toast.error(t("workspace.analysis.charts.chart_duplication_error"));
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
      const result = await addChartToDashboardAction({
        workspaceId,
        chartId: chart.id,
        dashboardId: selectedDashboardId,
      });

      if (!result?.data) {
        toast.error(
          getFormattedErrorMessage(result) || t("workspace.analysis.charts.failed_to_add_chart_to_dashboard")
        );
        return;
      }

      toast.success(t("workspace.analysis.charts.chart_added_to_dashboard"));
      setIsAddToDashboardDialogOpen(false);
      setSelectedDashboardId(undefined);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("workspace.analysis.charts.failed_to_add_chart_to_dashboard");
      toast.error(message);
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

      <DeleteDialog
        deleteWhat={t("common.chart")}
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        onDelete={handleDeleteChart}
        text={t("workspace.analysis.charts.delete_chart_confirmation")}
        isDeleting={isDeleting}
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
