"use client";

import { ChevronDownIcon } from "lucide-react";
import type { TWorkflowStatus } from "@formbricks/workflows";
import { Checkbox } from "@/modules/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

export interface TWorkflowStatusFilterOption {
  label: string;
  value: TWorkflowStatus;
}

interface WorkflowFilterDropdownProps {
  title: string;
  options: TWorkflowStatusFilterOption[];
  selectedOptions: TWorkflowStatus[];
  onToggleOption: (value: TWorkflowStatus) => void;
  isOpen: boolean;
  toggleDropdown: () => void;
}

export const WorkflowFilterDropdown = ({
  title,
  options,
  selectedOptions,
  onToggleOption,
  isOpen,
  toggleDropdown,
}: Readonly<WorkflowFilterDropdownProps>) => {
  const triggerClasses = `workflowFilterDropdown min-w-auto h-8 rounded-md border border-slate-700 sm:px-2 cursor-pointer outline-none
    ${selectedOptions.length > 0 ? "bg-slate-900 text-white" : "hover:bg-slate-900 hover:text-white"}`;

  return (
    <DropdownMenu open={isOpen} onOpenChange={toggleDropdown}>
      <DropdownMenuTrigger asChild className={triggerClasses}>
        <div className="flex items-center">
          <span className="text-sm">{title}</span>
          <ChevronDownIcon className="ml-2 size-4" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-slate-900">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="m-0 p-0"
            onClick={(e) => {
              e.preventDefault();
              onToggleOption(option.value);
            }}>
            <div className="flex h-full w-full items-center gap-x-2 px-2 py-1 hover:bg-slate-700">
              <Checkbox
                checked={selectedOptions.includes(option.value)}
                className={`bg-white ${selectedOptions.includes(option.value) ? "border-none bg-brand-dark" : ""}`}
              />
              <p className="font-normal text-white">{option.label}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
