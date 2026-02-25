"use client";

import { CopyIcon, MoreVertical, SquarePenIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { deleteChartAction, duplicateChartAction } from "@/modules/ee/analysis/charts/actions";
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
  environmentId: string;
  chart: TChartWithCreator;
}

export function ChartDropdownMenu({ environmentId, chart }: Readonly<ChartDropdownMenuProps>) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const result = await duplicateChartAction({ environmentId, chartId: chart.id });
      if (result?.data) {
        toast.success(t("environments.analysis.charts.chart_duplicated_successfully"));
        router.refresh();
      } else {
        toast.error(
          getFormattedErrorMessage(result) || t("environments.analysis.charts.chart_duplication_error")
        );
      }
    } catch {
      toast.error(t("environments.analysis.charts.chart_duplication_error"));
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteChartAction({ environmentId, chartId: chart.id });
      if (result?.data) {
        toast.success(t("environments.analysis.charts.chart_deleted_successfully"));
        setDeleteDialogOpen(false);
        router.refresh();
      } else {
        const msg =
          getFormattedErrorMessage(result) || t("environments.analysis.charts.chart_deletion_error");
        toast.error(msg);
      }
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = () => {
    toast(t("environments.analysis.charts.action_coming_soon"));
  };

  return (
    <div id={`chart-${chart.id}-actions`} data-testid="chart-dropdown-menu">
      <DropdownMenu>
        <DropdownMenuTrigger className="z-10" asChild>
          <Button variant="outline" className="px-2" onClick={(e) => e.stopPropagation()}>
            <span className="sr-only">{t("environments.analysis.charts.open_options")}</span>
            <MoreVertical className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max">
          <DropdownMenuGroup>
            <DropdownMenuItem icon={<SquarePenIcon className="size-4" />} onClick={handleEdit}>
              {t("common.edit")}
            </DropdownMenuItem>

            <DropdownMenuItem
              icon={<CopyIcon className="size-4" />}
              onClick={handleDuplicate}
              disabled={isDuplicating}>
              {t("common.duplicate")}
            </DropdownMenuItem>

            <DropdownMenuItem
              icon={<TrashIcon className="size-4" />}
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isDeleting}>
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDialog
        deleteWhat={t("common.chart")}
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={handleDelete}
        text={t("environments.analysis.charts.delete_chart_confirmation")}
        isDeleting={isDeleting}
      />
    </div>
  );
}
