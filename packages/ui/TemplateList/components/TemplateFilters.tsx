import { cn } from "@formbricks/lib/cn";
import { TProductIndustry } from "@formbricks/types/product";
import { TSurveyType } from "@formbricks/types/surveys";
import { TTemplateRole } from "@formbricks/types/templates";

interface TemplateFiltersProps {
  selectedFilter: (TSurveyType | TProductIndustry | TTemplateRole | null)[];
  setSelectedFilter: (filter: (TSurveyType | TProductIndustry | TTemplateRole | null)[]) => void;
  templateSearch?: string;
  prefilledFilters: (TSurveyType | TProductIndustry | TTemplateRole | null)[];
  allFilters: [
    { value: TSurveyType; label: string }[],
    { value: TProductIndustry; label: string }[],
    { value: TTemplateRole; label: string }[],
  ];
}

export const TemplateFilters = ({
  selectedFilter,
  setSelectedFilter,
  templateSearch,
  prefilledFilters,
  allFilters,
}: TemplateFiltersProps) => {
  const handleFilterSelect = (
    filterValue: TSurveyType | TProductIndustry | TTemplateRole | null,
    index: number
  ) => {
    // If the filter value at a particular index is null, it indicates that no filter has been chosen, therefore all results are displayed
    const newFilter = [...selectedFilter];
    newFilter[index] = filterValue;
    setSelectedFilter(newFilter);
  };

  return (
    <div className="mb-6 space-y-2">
      {allFilters.map((categories, index) => {
        if (prefilledFilters[index] !== null) return;
        return (
          <div className="flex flex-wrap gap-1">
            <button
              key={index}
              type="button"
              onClick={() => handleFilterSelect(null, index)}
              disabled={templateSearch && templateSearch.length > 0 ? true : false}
              className={cn(
                selectedFilter[index] === null
                  ? " bg-slate-800 font-semibold text-white"
                  : " bg-white text-slate-700 hover:bg-slate-100 focus:scale-105 focus:bg-slate-100 focus:outline-none focus:ring-0",
                "mt-2 rounded border border-slate-800 px-2 py-1 text-xs transition-all duration-150"
              )}>
              {index === 0 ? "All channels" : index === 1 ? "All Industries" : "All Roles"}
            </button>
            {categories.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => handleFilterSelect(category.value, index)}
                disabled={templateSearch && templateSearch.length > 0 ? true : false}
                className={cn(
                  selectedFilter[index] === category.value
                    ? " bg-slate-800 font-semibold text-white"
                    : " bg-white text-slate-700 hover:bg-slate-100 focus:scale-105 focus:bg-slate-100 focus:outline-none focus:ring-0",
                  "mt-2 rounded border border-slate-800 px-2 py-1 text-xs transition-all duration-150"
                )}>
                {category.label}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
};
