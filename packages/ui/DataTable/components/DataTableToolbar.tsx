import { Table } from "@tanstack/react-table";
import { MoveVerticalIcon, SettingsIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { TooltipRenderer } from "../../Tooltip";
import { SelectedRowSettings } from "./SelectedRowSettings";

interface DataTableToolbarProps<T> {
  setIsTableSettingsModalOpen: (isTableSettingsModalOpen: boolean) => void;
  setIsExpanded: (isExpanded: boolean) => void;
  isExpanded: boolean;
  table: Table<T>;
  deleteRows: (responseIds: string[]) => void;
  type: "person" | "response";
}

export const DataTableToolbar = <T,>({
  setIsExpanded,
  setIsTableSettingsModalOpen,
  isExpanded,
  table,
  deleteRows,
  type,
}: DataTableToolbarProps<T>) => {
  return (
    <div className="sticky top-12 z-30 my-2 flex w-full items-center justify-between bg-slate-50 py-2">
      {table.getFilteredSelectedRowModel().rows.length > 0 ? (
        <SelectedRowSettings table={table} deleteRows={deleteRows} type={type} />
      ) : (
        <div></div>
      )}
      <div className="flex space-x-2">
        <TooltipRenderer tooltipContent={"Table settings"} shouldRender={true}>
          <div
            onClick={() => setIsTableSettingsModalOpen(true)}
            className="cursor-pointer rounded-md border bg-white hover:border-slate-400">
            <SettingsIcon strokeWidth={1.5} className="m-1 h-6 w-6 p-0.5" />
          </div>
        </TooltipRenderer>
        <TooltipRenderer tooltipContent={isExpanded ? "Collapse rows" : "Expand rows"} shouldRender={true}>
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "cursor-pointer rounded-md border bg-white hover:border-slate-400",
              isExpanded && "bg-black text-white"
            )}>
            <MoveVerticalIcon strokeWidth={1.5} className="m-1 h-6 w-6 p-0.5" />
          </div>
        </TooltipRenderer>
      </div>
    </div>
  );
};
