import { Rows3, SettingsIcon } from "lucide-react";
import React from "react";
import { cn } from "@formbricks/lib/cn";

interface DataTableToolbarProps {
  setIsTableSettingsModalOpen: (isTableSettingsModalOpen: boolean) => void;
  setIsExpanded: (isExpanded: boolean) => void;
  isExpanded: boolean;
}

export const DataTableToolbar = ({
  setIsExpanded,
  setIsTableSettingsModalOpen,
  isExpanded,
}: DataTableToolbarProps) => {
  return (
    <div className="flex space-x-4">
      <div
        onClick={() => setIsTableSettingsModalOpen(true)}
        className="cursor-pointer rounded-md border bg-white">
        <SettingsIcon className="m-1 h-4 w-4" />
      </div>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn("cursor-pointer rounded-md border bg-white", isExpanded && "bg-black text-white")}>
        <Rows3 className="m-1 h-4 w-4" />
      </div>
    </div>
  );
};
