"use client";

import { CopyIcon, MoreVertical, SquarePenIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Button } from "@/modules/ui/components/button";
import { deleteChartAction, duplicateChartAction } from "../actions";
import { TChart } from "../types/analysis";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { useRouter } from "next/navigation";

interface ChartDropdownMenuProps {
  environmentId: string;
  chart: TChart;
  onEdit?: (chartId: string) => void;
}

export const ChartDropdownMenu = ({
  environmentId,
  chart,
  onEdit,
}: ChartDropdownMenuProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);

  const handleDeleteChart = async (chartId: string) => {
    setLoading(true);
    try {
      const result = await deleteChartAction({ environmentId, chartId });
      if (result?.data) {
        toast.success(t("environments.analysis.charts.chart_deleted_successfully"));
        setDeleteDialogOpen(false);
        router.refresh();
      } else {
        toast.error(getFormattedErrorMessage(result));
      }
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setLoading(false);
    }
  };

  const closeDropdown = () => {
    setTimeout(() => setIsDropDownOpen(false), 0);
  };

  const handleDuplicateChart = async () => {
    closeDropdown();
    setLoading(true);
    try {
      const result = await duplicateChartAction({ environmentId, chartId: chart.id });
      if (result?.data) {
        toast.success(t("environments.analysis.charts.chart_duplicated_successfully"));
        router.refresh();
      } else {
        toast.error(getFormattedErrorMessage(result) || t("environments.analysis.charts.chart_duplication_error"));
      }
    } catch {
      toast.error(t("environments.analysis.charts.chart_duplication_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    closeDropdown();
    setTimeout(() => onEdit?.(chart.id), 0);
  };

  const handleOpenDeleteDialog = () => {
    closeDropdown();
    setTimeout(() => setDeleteDialogOpen(true), 0);
  };

  return (
    <div
      id={`${chart.name.toLowerCase().split(" ").join("-")}-chart-actions`}
      data-testid="chart-dropdown-menu">
      <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
        <DropdownMenuTrigger className="z-10" asChild>
          <Button
            variant="outline"
            className="px-2"
            onClick={(e) => e.stopPropagation()}>
            <span className="sr-only">{t("environments.analysis.charts.open_options")}</span>
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max">
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={(e) => {
                  e.preventDefault();
                  handleEdit();
                }}>
                <SquarePenIcon className="mr-2 size-4" />
                {t("common.edit")}
              </button>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={(e) => {
                  e.preventDefault();
                  handleDuplicateChart();
                }}
                disabled={loading}>
                <CopyIcon className="mr-2 h-4 w-4" />
                {t("common.duplicate")}
              </button>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={(e) => {
                  e.preventDefault();
                  handleOpenDeleteDialog();
                }}>
                <TrashIcon className="mr-2 h-4 w-4" />
                {t("common.delete")}
              </button>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDialog
        deleteWhat={t("common.chart")}
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={() => handleDeleteChart(chart.id)}
        text={t("environments.analysis.charts.delete_chart_confirmation")}
        isDeleting={loading}
      />
    </div>
  );
};
