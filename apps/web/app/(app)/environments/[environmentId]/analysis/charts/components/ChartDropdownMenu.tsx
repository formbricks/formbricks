"use client";

import { CopyIcon, MoreVertical, SquarePenIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { TChart } from "../../types/analysis";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";

interface ChartDropdownMenuProps {
  environmentId: string;
  chart: TChart;
  disabled?: boolean;
  deleteChart: (chartId: string) => void;
  onEdit?: () => void;
}

export const ChartDropdownMenu = ({
  environmentId,
  chart,
  disabled,
  deleteChart,
  onEdit,
}: ChartDropdownMenuProps) => {
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);

  const handleDeleteChart = async (chartId: string) => {
    setLoading(true);
    try {
      // TODO: Implement deleteChartAction
      // await deleteChartAction({ chartId });
      deleteChart(chartId);
      toast.success("Chart deleted successfully");
    } catch (error) {
      toast.error("Error deleting chart");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id={`${chart.name.toLowerCase().split(" ").join("-")}-chart-actions`}
      data-testid="chart-dropdown-menu">
      <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
        <DropdownMenuTrigger className="z-10" asChild disabled={disabled}>
          <div
            className={cn(
              "rounded-lg border bg-white p-2",
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-50"
            )}
            onClick={(e) => e.stopPropagation()}>
            <span className="sr-only">Open options</span>
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max">
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={(e) => {
                  e.preventDefault();
                  setIsDropDownOpen(false);
                  onEdit?.();
                }}>
                <SquarePenIcon className="mr-2 size-4" />
                {t("common.edit")}
              </button>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={async (e) => {
                  e.preventDefault();
                  setIsDropDownOpen(false);
                  // TODO: Implement duplicate functionality
                  toast.success("Duplicate functionality coming soon");
                }}>
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
                  setIsDropDownOpen(false);
                  setDeleteDialogOpen(true);
                }}>
                <TrashIcon className="mr-2 h-4 w-4" />
                {t("common.delete")}
              </button>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDialog
        deleteWhat="Chart"
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={() => handleDeleteChart(chart.id)}
        text="Are you sure you want to delete this chart? This action cannot be undone."
        isDeleting={loading}
      />
    </div>
  );
};
