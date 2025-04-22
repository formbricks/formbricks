"use client";

import { cn } from "@/lib/cn";
import { useTranslate } from "@tolgee/react";
import { TTemplateFilter } from "@formbricks/types/templates";
import { getChannelMapping, getIndustryMapping, getRoleMapping } from "../lib/utils";

interface TemplateFiltersProps {
  selectedFilter: TTemplateFilter[];
  setSelectedFilter: (filter: TTemplateFilter[]) => void;
  templateSearch?: string;
  prefilledFilters: TTemplateFilter[];
}

export const TemplateFilters = ({
  selectedFilter,
  setSelectedFilter,
  templateSearch,
  prefilledFilters,
}: TemplateFiltersProps) => {
  const { t } = useTranslate();
  const handleFilterSelect = (filterValue: TTemplateFilter, index: number) => {
    // If the filter value at a particular index is null, it indicates that no filter has been chosen, therefore all results are displayed
    const newFilter = [...selectedFilter];
    newFilter[index] = filterValue;
    setSelectedFilter(newFilter);
  };

  const allFilters = [getChannelMapping(t), getIndustryMapping(t), getRoleMapping(t)];

  return (
    <div className="mb-6 gap-3">
      {allFilters.map((filters, index) => {
        if (prefilledFilters[index] !== null) return;
        return (
          <div key={filters[0]?.value || index} className="mt-2 flex flex-wrap gap-1 last:border-r-0">
            <button
              type="button"
              onClick={() => handleFilterSelect(null, index)}
              disabled={templateSearch && templateSearch.length > 0 ? true : false}
              className={cn(
                selectedFilter[index] === null
                  ? "bg-slate-800 font-semibold text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100 focus:scale-105 focus:bg-slate-100 focus:ring-0 focus:outline-none",
                "rounded border border-slate-800 px-2 py-1 text-xs transition-all duration-150"
              )}>
              {index === 0
                ? t("environments.surveys.templates.all_channels")
                : index === 1
                  ? t("environments.surveys.templates.all_industries")
                  : t("environments.surveys.templates.all_roles")}
            </button>
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => handleFilterSelect(filter.value, index)}
                disabled={templateSearch && templateSearch.length > 0 ? true : false}
                className={cn(
                  selectedFilter[index] === filter.value
                    ? "bg-slate-800 font-semibold text-white"
                    : "bg-white text-slate-700 hover:bg-slate-100 focus:scale-105 focus:bg-slate-100 focus:ring-0 focus:outline-none",
                  "rounded border border-slate-800 px-2 py-1 text-xs transition-all duration-150"
                )}>
                {t(filter.label)}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
};
