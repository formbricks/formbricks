"use client";

import { TFunction } from "i18next";
import { ChevronDownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TWorkflowSortBy } from "@formbricks/workflows";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface TWorkflowSortOption {
  label: string;
  value: TWorkflowSortBy;
}

const getSortOptions = (t: TFunction): TWorkflowSortOption[] => [
  { label: t("common.updated_at"), value: "updatedAt" },
  { label: t("common.created_at"), value: "createdAt" },
  { label: t("workspace.workflows.alphabetical"), value: "name" },
];

interface WorkflowSortDropdownProps {
  sortBy: TWorkflowSortBy;
  onSortChange: (value: TWorkflowSortBy) => void;
}

export const WorkflowSortDropdown = ({ sortBy, onSortChange }: Readonly<WorkflowSortDropdownProps>) => {
  const { t } = useTranslation();
  const options = getSortOptions(t);
  const activeLabel = options.find((option) => option.value === sortBy)?.label ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className="h-8 min-w-auto cursor-pointer rounded-md border border-slate-700 outline-none hover:bg-slate-900 hover:text-white sm:px-2">
        <button type="button" className="flex items-center" aria-label={t("common.sort_by")}>
          <span className="text-sm whitespace-nowrap">
            {t("common.sort_by_value", { label: activeLabel })}
          </span>
          <ChevronDownIcon className="ml-2 size-4" />
        </button>
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
