"use client";

import { CopyIcon, MoreVertical, SquarePenIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { deleteDashboardAction } from "../actions";
import { TDashboard } from "../types/analysis";

interface DashboardDropdownMenuProps {
  environmentId: string;
  dashboard: TDashboard;
  disabled?: boolean;
  deleteDashboard: (dashboardId: string) => void;
}

export const DashboardDropdownMenu = ({
  environmentId,
  dashboard,
  disabled,
  deleteDashboard,
}: DashboardDropdownMenuProps) => {
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);

  const handleDeleteDashboard = async (dashboardId: string) => {
    setLoading(true);
    try {
      const result = await deleteDashboardAction({ environmentId, dashboardId });
      if (result?.data) {
        deleteDashboard(dashboardId);
        toast.success("Dashboard deleted successfully");
      } else {
        toast.error(result?.serverError || "Failed to delete dashboard");
      }
    } catch (error) {
      toast.error("Error deleting dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id={`${dashboard.name.toLowerCase().split(" ").join("-")}-dashboard-actions`}
      data-testid="dashboard-dropdown-menu">
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
              <Link
                className="flex w-full items-center"
                href={`/environments/${environmentId}/analysis/dashboards/${dashboard.id}`}>
                <SquarePenIcon className="mr-2 size-4" />
                {t("common.edit")}
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={async (e) => {
                  e.preventDefault();
                  setIsDropDownOpen(false);
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
        deleteWhat="Dashboard"
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={() => handleDeleteDashboard(dashboard.id)}
        text="Are you sure you want to delete this dashboard? This action cannot be undone."
        isDeleting={loading}
      />
    </div>
  );
};
