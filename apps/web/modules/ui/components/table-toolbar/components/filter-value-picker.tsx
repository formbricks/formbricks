"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronDownIcon, CornerDownLeftIcon, SearchIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/modules/ui/components/command";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { getFilterValuesQuery } from "../lib/filter-values-query";
import type { TFilterOption, TFilterProperty } from "../lib/types";

const SEARCH_DEBOUNCE_MS = 250;

/**
 * One value of an Advanced filter rule, picked from the property's values: its fixed `options`, or the
 * values `loadOptions` looks up one search at a time. A property whose values are free (a string or a
 * number) also takes what is typed, offered as the list's first row; an enum takes only a listed value.
 */
export const FilterValuePicker = ({
  id,
  property,
  value,
  onChange,
  invalid = false,
}: Readonly<{
  id: string;
  property: TFilterProperty;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}>) => {
  const { t } = useTranslation();
  const listboxId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const loadOptions = property.loadOptions;
  const loaded = useQuery({
    ...getFilterValuesQuery(property, debouncedSearch),
    enabled: Boolean(loadOptions) && open,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const needle = search.trim();
  const staticOptions = property.options ?? [];
  const listed: TFilterOption[] = loadOptions
    ? (loaded.data?.options ?? [])
    : staticOptions.filter((option) => option.label.toLowerCase().includes(needle.toLowerCase()));
  const acceptsTyped = property.valueType !== "enum";
  const typedIsNew =
    acceptsTyped &&
    needle.length > 0 &&
    (property.valueType !== "number" || Number.isFinite(Number(needle))) &&
    !listed.some((option) => option.value === needle);
  const isLoading = Boolean(loadOptions) && loaded.isLoading;
  const isSearching = Boolean(loadOptions) && (loaded.isFetching || needle !== debouncedSearch);
  const selectedLabel = staticOptions.find((option) => option.value === value)?.label ?? value;

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-label={t("common.table_toolbar.value_of", { property: property.label })}
          className={cn(
            "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 text-left text-sm hover:border-slate-400 focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 focus:outline-hidden data-[state=open]:ring-2 data-[state=open]:ring-slate-400 data-[state=open]:ring-offset-1",
            invalid && "border-red-400 hover:border-red-500"
          )}>
          <span
            className={cn("truncate", !value && "text-slate-400")}
            title={value ? selectedLabel : undefined}>
            {value ? selectedLabel : t("common.table_toolbar.select_value")}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-64 overflow-hidden border-slate-200 p-0"
        onOpenAutoFocus={(event) => {
          // Straight into the search box, so typing narrows the list at once.
          event.preventDefault();
          searchRef.current?.focus();
        }}>
        <Command shouldFilter={false} loop>
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            {isSearching && !isLoading ? (
              <LoadingSpinner className="size-3.5 shrink-0" />
            ) : (
              <SearchIcon className="size-3.5 shrink-0 text-slate-400" />
            )}
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                // Enter with nothing highlighted takes what was typed, for a property that accepts it.
                if (event.key === "Enter" && typedIsNew && listed.length === 0) {
                  event.preventDefault();
                  pick(needle);
                }
              }}
              placeholder={t("common.search")}
              aria-label={t("common.table_toolbar.search_values", { property: property.label })}
              className="h-9 w-full border-none bg-transparent p-0 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-hidden"
            />
          </div>
          <CommandList
            id={listboxId}
            className="max-h-64 overflow-y-auto overscroll-contain rounded-none border-0 bg-transparent p-1 shadow-none">
            {isLoading && (
              <div className="flex justify-center py-6">
                <LoadingSpinner className="size-4" />
              </div>
            )}
            {!isLoading && loaded.isError && loadOptions && (
              <p role="alert" className="px-2 py-4 text-center text-sm text-red-600">
                {t("common.table_toolbar.values_failed")}
              </p>
            )}
            {!isLoading && !loaded.isError && !typedIsNew && (
              <CommandEmpty className="px-2 py-4 text-center text-sm text-slate-500">
                {needle
                  ? t("common.table_toolbar.no_values_match", { search: needle })
                  : t("common.table_toolbar.no_values")}
              </CommandEmpty>
            )}
            {!isLoading && (typedIsNew || listed.length > 0) && (
              <CommandGroup className="overflow-visible">
                {typedIsNew && (
                  <CommandItem value={`typed:${needle}`} onSelect={() => pick(needle)} className="gap-2">
                    <CornerDownLeftIcon className="size-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {t("common.table_toolbar.use_typed_value", { value: needle })}
                    </span>
                  </CommandItem>
                )}
                {listed.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <CommandItem
                      key={option.value}
                      value={`option:${option.value}`}
                      onSelect={() => pick(option.value)}
                      className="gap-2">
                      <span
                        className={cn("flex-1 truncate", isSelected && "font-medium text-slate-900")}
                        title={option.label}>
                        {option.label}
                      </span>
                      {isSelected && <CheckIcon className="size-4 shrink-0 text-slate-700" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
          {!isLoading && loaded.data?.hasMore && loadOptions && (
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              {t("common.table_toolbar.refine_search_for_more", { count: loaded.data.options.length })}
            </p>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
};
