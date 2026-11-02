"use client";

import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import type { TFilterOption, TFilterProperty } from "../lib/types";

const SEARCH_DEBOUNCE_MS = 250;
/** Fixed lists longer than this get a search box too. */
const SEARCHABLE_FROM = 8;

/**
 * The ticked values of one quick filter. Fixed options come with the property; long or dynamic ones
 * are loaded per search through `loadOptions`, so a property with thousands of values never ships them
 * all. Ticked values that the current search does not return stay listed, so they can be unticked.
 */
export const FilterValueList = ({
  property,
  selected,
  onToggle,
}: Readonly<{
  property: TFilterProperty;
  selected: readonly string[];
  onToggle: (value: string) => void;
}>) => {
  const { t } = useTranslation();
  const baseId = useId();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const loadOptions = property.loadOptions;
  const loaded = useQuery({
    queryKey: ["table-filter-values", property.id, debouncedSearch],
    queryFn: () => loadOptions!(debouncedSearch),
    enabled: Boolean(loadOptions),
    staleTime: 30_000,
  });

  const staticOptions = property.options ?? [];
  const isSearchable = Boolean(loadOptions) || staticOptions.length >= SEARCHABLE_FROM;
  const needle = search.trim().toLowerCase();
  const baseOptions: TFilterOption[] = loadOptions
    ? (loaded.data ?? [])
    : staticOptions.filter((option) => !needle || option.label.toLowerCase().includes(needle));

  const knownValues = new Set(baseOptions.map((option) => option.value));
  const labelFor = (value: string) => staticOptions.find((option) => option.value === value)?.label ?? value;
  const options: TFilterOption[] = [
    ...selected
      .filter((value) => !knownValues.has(value))
      .map((value) => ({ value, label: labelFor(value) })),
    ...baseOptions,
  ];

  return (
    <div className="flex w-60 flex-col">
      {isSearchable && (
        <div className="flex items-center gap-2 border-b border-slate-100 px-2 pb-1.5">
          <SearchIcon className="size-3.5 shrink-0 text-slate-400" />
          <input
            type="text"
            value={search}
            // Radix menus move focus on typed characters; keep typing inside the box.
            onKeyDown={(event) => event.stopPropagation()}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("common.search")}
            aria-label={t("common.table_toolbar.search_values", { property: property.label })}
            className="h-7 w-full border-none bg-transparent p-0 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-hidden"
          />
        </div>
      )}
      <ul className="max-h-64 overflow-y-auto py-1" aria-label={property.label}>
        {loaded.isLoading && loadOptions ? (
          <li className="flex justify-center py-3">
            <LoadingSpinner className="size-4" />
          </li>
        ) : null}
        {loaded.isError && loadOptions ? (
          <li className="px-2 py-2 text-xs text-red-600">{t("common.table_toolbar.values_failed")}</li>
        ) : null}
        {!loaded.isLoading && options.length === 0 ? (
          <li className="px-2 py-2 text-xs text-slate-500">{t("common.no_results")}</li>
        ) : null}
        {options.map((option, index) => {
          const id = `${baseId}-${index}`;
          return (
            <li key={option.value}>
              <label
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                <Checkbox
                  id={id}
                  checked={selected.includes(option.value)}
                  onCheckedChange={() => onToggle(option.value)}
                />
                <span className="truncate">{option.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
