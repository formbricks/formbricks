"use client";

import { ChevronDownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import type { TCreativeSortBy } from "../lib/list-filters";

// Same control as the surveys and workflows lists' sort dropdown.
export const CreativesSortDropdown = ({
  sortBy,
  onSortChange,
}: Readonly<{ sortBy: TCreativeSortBy; onSortChange: (value: TCreativeSortBy) => void }>) => {
  const { t } = useTranslation();
  const options: { label: string; value: TCreativeSortBy }[] = [
    { label: t("common.updated_at"), value: "updatedAt" },
    { label: t("common.created_at"), value: "createdAt" },
    { label: t("workspace.surveys.alphabetical"), value: "name" },
  ];
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
