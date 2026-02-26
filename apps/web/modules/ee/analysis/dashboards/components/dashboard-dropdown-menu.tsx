"use client";

import { CopyIcon, MoreVertical, SquarePenIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);

  const handleDuplicateDashboard = async () => {
    setIsDuplicating(true);
    try {
      const result = await duplicateDashboardAction({ environmentId, dashboardId });
      if (result?.data) {
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
        setIsDeleteDialogOpen(false);
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
            <DropdownMenuItem icon={<SquarePenIcon className="size-4" />} asChild>
              <Link href={`/environments/${environmentId}/analysis/dashboards/${dashboardId}`}>
                {t("common.edit")}
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              icon={<CopyIcon className="size-4" />}
              disabled={isDuplicating}
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
        text={t("environments.analysis.dashboards.delete_confirmation")}
        isDeleting={isDeleting}
      />
    </div>
  );
};
