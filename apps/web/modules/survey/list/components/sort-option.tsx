"use client";

import { DropdownMenuItem } from "@/modules/ui/components/dropdown-menu";
import { useTranslate } from "@tolgee/react";
import { TSortOption, TSurveyFilters } from "@formbricks/types/surveys/types";

interface SortOptionProps {
  option: TSortOption;
  sortBy: TSurveyFilters["sortBy"];
  handleSortChange: (option: TSortOption) => void;
}

export const SortOption = ({ option, sortBy, handleSortChange }: SortOptionProps) => {
  const { t } = useTranslate();
  return (
    <DropdownMenuItem
      key={option.label}
      className="m-0 p-0"
      onClick={() => {
        handleSortChange(option);
      }}>
      <div className="flex h-full w-full items-center space-x-2 px-2 py-1 hover:bg-slate-700">
        <span
          className={`h-4 w-4 rounded-full border ${sortBy === option.value ? "bg-brand-dark outline-brand-dark border-slate-900 outline" : "border-white"}`}></span>
        <p className="font-normal text-white">{t(option.label)}</p>
      </div>
    </DropdownMenuItem>
  );
};
