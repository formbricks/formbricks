"use client";

import { CopyIcon, MoreVertical, SquarePenIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { deleteDashboardAction, duplicateDashboardAction } from "../actions";

interface DashboardDropdownMenuProps {
  environmentId: string;
  dashboardId: string;
  dashboardName: string;
}

export const DashboardDropdownMenu = ({
  environmentId,
  dashboardId,
  dashboardName,
}: Readonly<DashboardDropdownMenuProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);

  const handleDuplicateDashboard = async () => {
    setIsDuplicating(true);
    try {
      const result = await duplicateDashboardAction({ environmentId, dashboardId });
      if (result?.data) {
        router.refresh();
        toast.success(t("environments.analysis.dashboards.duplicate_success"));
      } else {
        toast.error(result?.serverError || t("environments.analysis.dashboards.duplicate_failed"));
      }
    } catch {
      toast.error(t("environments.analysis.dashboards.duplicate_failed"));
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDeleteDashboard = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteDashboardAction({ environmentId, dashboardId });
      if (result?.data) {
        router.refresh();
        toast.success(t("environments.analysis.dashboards.delete_success"));
      } else {
        toast.error(result?.serverError || t("environments.analysis.dashboards.delete_failed"));
      }
    } catch {
      toast.error(t("environments.analysis.dashboards.delete_failed"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      data-testid={`${dashboardName.toLowerCase().split(" ").join("-")}-dashboard-actions`}
      onClick={(e) => e.stopPropagation()}>
      <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
        <DropdownMenuTrigger className="z-10" asChild>
          <div className="cursor-pointer rounded-lg border bg-white p-2 hover:bg-slate-50">
            <span className="sr-only">{t("common.open_options")}</span>
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max">
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Link
                className="flex w-full items-center"
                href={`/environments/${environmentId}/analysis/dashboards/${dashboardId}`}>
                <SquarePenIcon className="mr-2 size-4" />
                {t("common.edit")}
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                disabled={isDuplicating}
                onClick={(e) => {
                  e.preventDefault();
                  setIsDropDownOpen(false);
                  handleDuplicateDashboard();
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
        deleteWhat={t("common.dashboard")}
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={handleDeleteDashboard}
        text={t("environments.analysis.dashboards.delete_confirmation")}
        isDeleting={isDeleting}
      />
    </div>
  );
};
