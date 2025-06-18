"use client";

import { Input } from "@/modules/ui/components/input";
import { cn } from "@/modules/ui/lib/utils";
import { useTranslate } from "@tolgee/react";
import { ChevronDown, Search as SearchIcon, X as XIcon } from "lucide-react";
import { useState } from "react";
import { useDebounce } from "react-use";
import { TSortOption } from "@formbricks/types/surveys/types";

interface SearchSectionProps {
  setSearchQuery: (query: string) => void;
  sortBy?: string;
  setSortBy?: (sortBy: string) => void;
}

const getSortOptions = (t: (key: string) => string): TSortOption[] => [
  // {
  //   label: t("common.updated_at"),
  //   value: "updatedAt",
  // },
  {
    label: t("common.latest"),
    value: "createdAt",
  },
  {
    label: t("environments.surveys.alphabetical"),
    value: "name",
  },
];

export function SearchSection({ setSearchQuery, sortBy = "createdAt", setSortBy }: SearchSectionProps) {
  const { t } = useTranslate();
  const [query, setQuery] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const sortOptions = getSortOptions(t);

  useDebounce(
    () => {
      setSearchQuery(query);
    },
    500,
    [query]
  );

  const handleClear = () => {
    setQuery("");
    setSearchQuery("");
  };

  const handleSortChange = (option: TSortOption) => {
    if (setSortBy) {
      setSortBy(option.value);
      setIsDropdownOpen(false);
    }
  };

  const getCurrentSortLabel = () => {
    const currentOption = sortOptions.find((option) => option.value === sortBy);
    return currentOption?.label || t("common.latest");
  };

  return (
    <div className="flex h-10 w-full gap-2">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3">
          <SearchIcon className="h-4 w-4 text-slate-400" />
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("environments.activity.search.search_engagements")}
          className="w-full border-slate-300 px-10 focus:border-slate-400"
        />

        {query && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <button
              onClick={handleClear}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          className="flex h-10 min-w-28 items-center justify-between gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
          <span className="text-slate-900">{getCurrentSortLabel()}</span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 z-10 mt-1 w-full origin-top-right rounded-md bg-white shadow-lg">
            <div className="py-1">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  className={cn(
                    "w-full px-4 py-2 text-left text-sm",
                    sortBy == option.value
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                  )}
                  onClick={() => handleSortChange(option)}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchSection;
