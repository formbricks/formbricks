"use client";

import { useTranslation } from "react-i18next";
import { TTemplateFilter } from "@formbricks/types/templates";
import { cn } from "@/lib/cn";
import { getChannelMapping, getIndustryMapping, getRoleMapping } from "../lib/utils";

interface TemplateFiltersProps {
  readonly selectedFilter: TTemplateFilter[];
  readonly setSelectedFilter: (filter: TTemplateFilter[]) => void;
  readonly templateSearch?: string;
}

export const TemplateFilters = ({
  selectedFilter,
  setSelectedFilter,
  templateSearch,
}: TemplateFiltersProps) => {
  const { t } = useTranslation();
  const handleFilterSelect = (filterValue: TTemplateFilter, index: number) => {
    // If the filter value at a particular index is null, it indicates that no filter has been chosen, therefore all results are displayed
    const newFilter = [...selectedFilter];
    newFilter[index] = filterValue;
    setSelectedFilter(newFilter);
  };

  const allFilters = [getChannelMapping(t), getIndustryMapping(t), getRoleMapping(t)];
  // The "all" choice of each filter in `allFilters`, in the same order.
  const allFilterLabels = [
    t("workspace.surveys.templates.all_channels"),
    t("workspace.surveys.templates.all_industries"),
    t("workspace.surveys.templates.all_roles"),
  ];

  return (
    <div className="mb-6 gap-3">
      {allFilters.map((filters, index) => {
        return (
          <div key={filters[0]?.value || index} className="mt-2 flex flex-wrap gap-1 last:border-r-0">
            <button
              type="button"
              onClick={() => handleFilterSelect(null, index)}
              disabled={Boolean(templateSearch && templateSearch.length > 0)}
              className={cn(
                selectedFilter[index] === null
                  ? "bg-slate-800 font-semibold text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100 focus:scale-105 focus:bg-slate-100 focus:ring-0 focus:outline-hidden",
                "rounded-sm border border-slate-800 px-2 py-1 text-xs transition-all duration-150"
              )}>
              {allFilterLabels[index]}
            </button>
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => handleFilterSelect(filter.value, index)}
                disabled={Boolean(templateSearch && templateSearch.length > 0)}
                className={cn(
                  selectedFilter[index] === filter.value
                    ? "bg-slate-800 font-semibold text-white"
                    : "bg-white text-slate-700 hover:bg-slate-100 focus:scale-105 focus:bg-slate-100 focus:ring-0 focus:outline-hidden",
                  "rounded-sm border border-slate-800 px-2 py-1 text-xs transition-all duration-150"
                )}>
                {filter.label}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
};
