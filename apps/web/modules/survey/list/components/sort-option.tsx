"use client";

import { TSortOption } from "@formbricks/types/surveys/types";
import { TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";
import { DropdownMenuItem } from "@/modules/ui/components/dropdown-menu";

interface SortOptionProps {
  option: TSortOption;
  sortBy: TSurveyOverviewFilters["sortBy"];
  handleSortChange: (option: TSortOption) => void;
}

export const SortOption = ({ option, sortBy, handleSortChange }: SortOptionProps) => {
  return (
    <DropdownMenuItem
      key={option.label}
      className="m-0 p-0"
      onClick={() => {
        handleSortChange(option);
      }}>
      <div className="flex h-full w-full items-center space-x-2 px-2 py-1 hover:bg-slate-700">
        <span
          className={`h-4 w-4 rounded-full border ${sortBy === option.value ? "border-slate-900 bg-brand-dark outline outline-brand-dark" : "border-white"}`}></span>
        <p className="font-normal text-white">{option.label}</p>
      </div>
    </DropdownMenuItem>
  );
};
