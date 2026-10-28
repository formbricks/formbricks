"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, MoreVertical, SquarePenIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  deleteDashboard,
  duplicateDashboard,
  getChartApiErrorMessage,
} from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface DashboardDropdownMenuProps {
  workspaceId: string;
  dashboardId: string;
  dashboardName: string;
}

export const DashboardDropdownMenu = ({
  workspaceId,
  dashboardId,
  dashboardName,
}: Readonly<DashboardDropdownMenuProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const invalidateLists = () => queryClient.invalidateQueries({ queryKey: dashboardKeys.lists() });
  const duplicateMutation = useMutation({
    mutationFn: () => duplicateDashboard(dashboardId),
    onSettled: invalidateLists,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteDashboard(dashboardId),
    onSettled: invalidateLists,
  });

  const handleDuplicateDashboard = () =>
    duplicateMutation.mutate(undefined, {
      onSuccess: () => toast.success(t("workspace.analysis.dashboards.duplicate_success")),
      onError: (error) =>
        toast.error(getChartApiErrorMessage(error, t("workspace.analysis.dashboards.duplicate_failed"))),
    });

  const handleDeleteDashboard = () =>
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        setIsDeleteDialogOpen(false);
        toast.success(t("workspace.analysis.dashboards.delete_success"));
      },
      onError: (error) =>
        toast.error(getChartApiErrorMessage(error, t("workspace.analysis.dashboards.delete_failed"))),
    });

  return (
    <div data-testid={`${dashboardName.toLowerCase().split(" ").join("-")}-dashboard-actions`}>
      <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
        <DropdownMenuTrigger className="z-10" asChild>
          <Button variant="outline" className="px-2">
            <span className="sr-only">{t("common.open_options")}</span>
            <MoreVertical className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max" align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem
              icon={<SquarePenIcon className="size-4" />}
              onClick={() => {
                setIsDropDownOpen(false);
                router.push(`/workspaces/${workspaceId}/dashboards/${dashboardId}`);
              }}>
              {t("common.edit")}
            </DropdownMenuItem>

            <DropdownMenuItem
              icon={<CopyIcon className="size-4" />}
              disabled={duplicateMutation.isPending}
              onClick={() => {
                setIsDropDownOpen(false);
                handleDuplicateDashboard();
              }}>
              {t("common.duplicate")}
            </DropdownMenuItem>

            <DropdownMenuItem
              icon={<TrashIcon className="size-4" />}
              onClick={() => {
                setIsDropDownOpen(false);
                setIsDeleteDialogOpen(true);
              }}>
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDialog
        deleteWhat={t("common.dashboard")}
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        onDelete={handleDeleteDashboard}
        text={t("workspace.analysis.dashboards.delete_confirmation")}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
};
