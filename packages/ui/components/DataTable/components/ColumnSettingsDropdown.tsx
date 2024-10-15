import { Column } from "@tanstack/react-table";
import { EllipsisVerticalIcon, EyeOffIcon, SettingsIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../DropdownMenu";

interface ColumnSettingsDropdownProps<T> {
  column: Column<T>;
  setIsTableSettingsModalOpen: (isTableSettingsModalOpen: boolean) => void;
}

export const ColumnSettingsDropdown = <T,>({
  column,
  setIsTableSettingsModalOpen,
}: ColumnSettingsDropdownProps<T>) => {
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
          }}
          icon={<EyeOffIcon className="h-4 w-4" />}>
          <div className="flex items-center space-x-2">
            <span>Hide column</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="capitalize"
          onClick={() => setIsTableSettingsModalOpen(true)}
          icon={<SettingsIcon className="h-4 w-4" />}>
          <div className="flex items-center space-x-2">
            <span>Table settings</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
