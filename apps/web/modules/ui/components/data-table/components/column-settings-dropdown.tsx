"use client";

import { Column } from "@tanstack/react-table";
import { EllipsisVerticalIcon, EyeOffIcon, SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface ColumnSettingsDropdownProps<T> {
  column: Column<T>;
  setIsTableSettingsModalOpen: (isTableSettingsModalOpen: boolean) => void;
}

export const ColumnSettingsDropdown = <T,>({
  column,
  setIsTableSettingsModalOpen,
}: ColumnSettingsDropdownProps<T>) => {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="py-2 focus:outline-hidden">
          <EllipsisVerticalIcon name="three-dots" className="size-4" />{" "}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            column.toggleVisibility(false);
          }}
          icon={<EyeOffIcon className="size-4" />}>
          <div className="flex items-center gap-x-2">
            <span>{t("common.hide_column")}</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setIsTableSettingsModalOpen(true)}
          icon={<SettingsIcon className="size-4" />}>
          <div className="flex items-center gap-x-2">
            <span>{t("common.table_settings")}</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
