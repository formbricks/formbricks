"use client";

import { ChevronDownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TWorkflowSortBy } from "@formbricks/workflows";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

export interface TWorkflowSortOption {
  label: string;
  value: TWorkflowSortBy;
}

interface WorkflowSortDropdownProps {
  options: TWorkflowSortOption[];
  sortBy: TWorkflowSortBy;
  onSortChange: (value: TWorkflowSortBy) => void;
}

export const WorkflowSortDropdown = ({
  options,
  sortBy,
  onSortChange,
}: Readonly<WorkflowSortDropdownProps>) => {
  const { t } = useTranslation();
  const activeLabel = options.find((option) => option.value === sortBy)?.label ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className="min-w-auto h-8 cursor-pointer rounded-md border border-slate-700 outline-none hover:bg-slate-900 hover:text-white sm:px-2">
        <div className="flex items-center">
          <span className="whitespace-nowrap text-sm">
            {t("common.sort_by")}: {activeLabel}
          </span>
          <ChevronDownIcon className="ml-2 size-4" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-slate-900">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} className="m-0 p-0" onClick={() => onSortChange(option.value)}>
            <div className="flex h-full w-full items-center gap-x-2 px-2 py-1 hover:bg-slate-700">
              <span
                className={`h-4 w-4 rounded-full border ${
                  sortBy === option.value
                    ? "border-slate-900 bg-brand-dark outline outline-brand-dark"
                    : "border-white"
                }`}
              />
              <p className="font-normal text-white">{option.label}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
