import { Column } from "@tanstack/react-table";
import { EllipsisVerticalIcon, EyeOffIcon, SettingsIcon } from "lucide-react";
import React from "react";
import { TResponseTableData } from "@formbricks/types/responses";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";

interface ColumnSettingsDropdownProps {
  column: Column<TResponseTableData>;
  setIsTableSettingsModalOpen: (isTableSettingsModalOpen: boolean) => void;
}

export const ColumnSettingsDropdown = ({
  column,
  setIsTableSettingsModalOpen,
}: ColumnSettingsDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="py-2 focus:outline-none">
          <EllipsisVerticalIcon name="three-dots" className="h-4 w-4" />{" "}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="capitalize"
          onClick={() => {
            column.toggleVisibility(false);
          }}>
          <div className="flex items-center space-x-2">
            <EyeOffIcon className="h-4 w-4" />
            <span>Hide column</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem className="capitalize" onClick={() => setIsTableSettingsModalOpen(true)}>
          <div className="flex items-center space-x-2">
            <SettingsIcon className="h-4 w-4" />
            <span>Table settings</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
