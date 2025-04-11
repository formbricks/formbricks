"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Column } from "@tanstack/react-table";
import { useTranslate } from "@tolgee/react";
import { EllipsisVerticalIcon, EyeOffIcon, SettingsIcon } from "lucide-react";

interface ColumnSettingsDropdownProps<T> {
  column: Column<T>;
  setIsTableSettingsModalOpen: (isTableSettingsModalOpen: boolean) => void;
}

export const ColumnSettingsDropdown = <T,>({
  column,
  setIsTableSettingsModalOpen,
}: ColumnSettingsDropdownProps<T>) => {
  const { t } = useTranslate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="py-2 focus:outline-hidden">
          <EllipsisVerticalIcon name="three-dots" className="h-4 w-4" />{" "}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="capitalize"
          onClick={() => {
            column.toggleVisibility(false);
          }}
          icon={<EyeOffIcon className="h-4 w-4" />}>
          <div className="flex items-center space-x-2">
            <span>{t("common.hide_column")}</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="capitalize"
          onClick={() => setIsTableSettingsModalOpen(true)}
          icon={<SettingsIcon className="h-4 w-4" />}>
          <div className="flex items-center space-x-2">
            <span>{t("common.table_settings")}</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
