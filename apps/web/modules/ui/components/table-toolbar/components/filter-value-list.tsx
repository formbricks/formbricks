"use client";

import { useQuery } from "@tanstack/react-query";
import { LockIcon, SearchIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { isUnavailableValue, useAvailableValues } from "../hooks/use-available-values";
import { getFilterValuesQuery } from "../lib/filter-values-query";
import type { TFilterOption, TFilterProperty } from "../lib/types";

const SEARCH_DEBOUNCE_MS = 250;
/** Fixed lists longer than this get a search box too. */
const SEARCHABLE_FROM = 8;

/**
 * The ticked values of one quick filter. Fixed options come with the property; long or dynamic ones
 * are loaded per search through `loadOptions`, so a property with thousands of values never ships them
 * all. Ticked values that the current search does not return stay listed, so they can be unticked.
 * `locked` values were set for everyone (a dashboard's locked filters): they show ticked, with a lock and
 * `lockedHint` on hover, and cannot be ticked again as a person's own. A property that says which of its
 * values occur (`availableValues`) shows the others greyed, not to be ticked.
 */
export const FilterValueList = ({
  property,
  selected,
  onToggle,
  locked = [],
  lockedHint,
}: Readonly<{
  property: TFilterProperty;
  selected: readonly string[];
  onToggle: (value: string) => void;
  locked?: readonly string[];
  lockedHint?: string;
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
    ...getFilterValuesQuery(property, debouncedSearch),
    enabled: Boolean(loadOptions),
    staleTime: 30_000,
  });

  const available = useAvailableValues(property);
  const staticOptions = property.options ?? [];
  const isSearchable = Boolean(loadOptions) || staticOptions.length >= SEARCHABLE_FROM;
  const needle = search.trim().toLowerCase();
  const baseOptions: TFilterOption[] = loadOptions
    ? (loaded.data?.options ?? [])
    : staticOptions.filter((option) => !needle || option.label.toLowerCase().includes(needle));

  const knownValues = new Set(baseOptions.map((option) => option.value));
  const labelFor = (value: string) => staticOptions.find((option) => option.value === value)?.label ?? value;
  const pinned = [...new Set([...locked, ...selected])];
  const options: TFilterOption[] = [
    ...pinned.filter((value) => !knownValues.has(value)).map((value) => ({ value, label: labelFor(value) })),
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
          if (locked.includes(option.value)) {
            return (
              <li key={option.value}>
                <label
                  htmlFor={id}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-500">
                  <Checkbox id={id} checked disabled />
                  <span className="flex-1 truncate">{option.label}</span>
                  <TooltipRenderer tooltipContent={lockedHint} shouldRender={Boolean(lockedHint)}>
                    <LockIcon className="size-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                  </TooltipRenderer>
                  {lockedHint && <span className="sr-only">{lockedHint}</span>}
                </label>
              </li>
            );
          }
          const unavailable = isUnavailableValue(available, option.value, selected);
          return (
            <li key={option.value}>
              <label
                htmlFor={id}
                className={
                  unavailable
                    ? "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-400"
                    : "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                }>
                <Checkbox
                  id={id}
                  checked={selected.includes(option.value)}
                  disabled={unavailable}
                  onCheckedChange={() => onToggle(option.value)}
                />
                <span className="truncate">{option.label}</span>
              </label>
            </li>
          );
        })}
        {loaded.data?.hasMore && loadOptions ? (
          <li className="px-2 py-2 text-xs text-slate-500">
            {t("common.table_toolbar.refine_search_for_more", { count: loaded.data.options.length })}
          </li>
        ) : null}
      </ul>
    </div>
  );
};
