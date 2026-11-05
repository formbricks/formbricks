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

/** The values a search lists: what the lookup returned, or the fixed options whose label holds it. */
const listedOptions = (
  property: TFilterProperty,
  loadedOptions: readonly TFilterOption[] | undefined,
  needle: string
): TFilterOption[] => {
  if (property.loadOptions) return [...(loadedOptions ?? [])];
  const lowered = needle.toLowerCase();
  return (property.options ?? []).filter((option) => option.label.toLowerCase().includes(lowered));
};

/** The listed values, after every picked one the search did not return, so each can still be unticked. */
const withPickedFirst = (
  picked: readonly string[],
  listed: readonly TFilterOption[],
  labelOf: (value: string) => string
): TFilterOption[] => [
  ...picked
    .filter((value) => !listed.some((option) => option.value === value))
    .map((value) => ({ value, label: labelOf(value) })),
  ...listed,
];

/**
 * Whether what is typed can be taken as a value of its own: the property takes free values (not an enum),
 * it is a number where a number is due, and the list does not already hold it.
 */
const isNewTypedValue = (
  property: TFilterProperty,
  typed: string,
  listed: readonly TFilterOption[]
): boolean =>
  property.valueType !== "enum" &&
  typed.length > 0 &&
  (property.valueType !== "number" || Number.isFinite(Number(typed))) &&
  !listed.some((option) => option.value === typed);

type TPickOne = {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
};

type TPickSeveral = {
  multiple: true;
  value: readonly string[];
  onChange: (values: string[]) => void;
};

/**
 * The value of an Advanced filter rule, picked from the property's values: its fixed `options`, or the
 * values `loadOptions` looks up one search at a time. A property whose values are free (a string or a
 * number) also takes what is typed, offered as the list's first row; an enum takes only a listed value.
 * With `multiple`, each pick ticks or unticks a value and the list stays open, and the values already
 * ticked stay listed whatever the search returns, so they can be unticked.
 */
export const FilterValuePicker = ({
  id,
  property,
  invalid = false,
  ...selection
}: Readonly<
  {
    id: string;
    property: TFilterProperty;
    invalid?: boolean;
  } & (TPickOne | TPickSeveral)
>) => {
  const { t } = useTranslation();
  const listboxId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Labels of the looked-up values picked here, so the trigger names them after the search moves on.
  const [pickedLabels, setPickedLabels] = useState<ReadonlyMap<string, string>>(new Map());

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
  const listed = listedOptions(property, loaded.data?.options, needle);
  const selected: readonly string[] = selection.multiple
    ? selection.value
    : [selection.value].filter((value) => value !== "");
  const labelOf = (value: string) =>
    staticOptions.find((option) => option.value === value)?.label ??
    pickedLabels.get(value) ??
    listed.find((option) => option.value === value)?.label ??
    value;
  const shown = selection.multiple ? withPickedFirst(selected, listed, labelOf) : listed;
  const typedIsNew = isNewTypedValue(property, needle, shown);
  const isLoading = Boolean(loadOptions) && loaded.isLoading;
  const isSearching = Boolean(loadOptions) && (loaded.isFetching || needle !== debouncedSearch);
  const selectedLabel = selected.map(labelOf).join(", ");

  const pick = (next: string, label = next) => {
    setPickedLabels((current) => new Map(current).set(next, label));
    if (!selection.multiple) {
      selection.onChange(next);
      setOpen(false);
      return;
    }
    selection.onChange(
      selected.includes(next) ? selected.filter((value) => value !== next) : [...selected, next]
    );
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
            className={cn("truncate", selected.length === 0 && "text-slate-400")}
            title={selected.length > 0 ? selectedLabel : undefined}>
            {selected.length > 0 && selectedLabel}
            {selected.length === 0 &&
              (selection.multiple
                ? t("common.table_toolbar.select_values")
                : t("common.table_toolbar.select_value"))}
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
                // Enter confirms an IME candidate while composing; the text is not the value yet.
                if (event.nativeEvent.isComposing) return;
                // Enter with nothing highlighted takes what was typed, for a property that accepts it.
                if (event.key === "Enter" && typedIsNew && shown.length === 0) {
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
            {!isLoading && (typedIsNew || shown.length > 0) && (
              <CommandGroup className="overflow-visible">
                {typedIsNew && (
                  <CommandItem value={`typed:${needle}`} onSelect={() => pick(needle)} className="gap-2">
                    <CornerDownLeftIcon className="size-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {t("common.table_toolbar.use_typed_value", { value: needle })}
                    </span>
                  </CommandItem>
                )}
                {shown.map((option) => {
                  const isSelected = selected.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={`option:${option.value}`}
                      onSelect={() => pick(option.value, option.label)}
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
