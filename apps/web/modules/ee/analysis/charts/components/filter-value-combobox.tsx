"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getDimensionValuesAction } from "@/modules/ee/analysis/charts/actions";
import { QUESTION_LABEL_DIMENSION_ID } from "@/modules/ee/analysis/lib/dimension-value-lookup";
import { FieldTypeIcon } from "@/modules/ee/unify-feedback/lib/field-type-icons";
import { formatFieldTypeLabel } from "@/modules/ee/unify-feedback/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/modules/ui/components/command";
import { Input } from "@/modules/ui/components/input";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { cn } from "@/modules/ui/lib/utils";

interface FilterValueComboboxProps {
  workspaceId: string;
  feedbackDirectoryId: string;
  dimension: string;
  value: string;
  onChange: (value: string | null) => void;
}

const SEARCH_DEBOUNCE_MS = 250;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Pick-list for a filter value, backed by the distinct stored values of a low-cardinality
 * string dimension. Selecting a real stored value guarantees an exact match for the
 * `equals` / `notEquals` operators (no casing/whitespace drift). Search narrows results
 * server-side so dimensions with more than the lookup cap stay usable.
 *
 * For the question-label dimension each value also carries its field type, rendered as the
 * question-type icon so questions are recognizable at a glance.
 */
export function FilterValueCombobox({
  workspaceId,
  feedbackDirectoryId,
  dimension,
  value,
  onChange,
}: Readonly<FilterValueComboboxProps>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const trimmedSearch = search.trim();
  const debouncedSearch = useDebounce(trimmedSearch, SEARCH_DEBOUNCE_MS);

  // Only the question-label lookup carries a field type per value, so it is the only
  // list that can show question-type icons.
  const showFieldTypeIcons = dimension === QUESTION_LABEL_DIMENSION_ID;

  const {
    data: values = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dimensionValues", workspaceId, feedbackDirectoryId, dimension, debouncedSearch],
    queryFn: async () => {
      const result = await getDimensionValuesAction({
        workspaceId,
        feedbackDirectoryId,
        dimension,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });

      if (result?.serverError || result?.validationErrors) {
        throw new Error(getFormattedErrorMessage(result));
      }

      return Array.isArray(result?.data) ? result.data : [];
    },
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5, // 5 minutes cache validity
  });

  // Reset the transient search term whenever the popover closes.
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              setOpen(false);
            }
          }}
          className={cn(
            // Grows into the leftover width of the filter row so long question labels stay
            // readable, without ever getting narrower than the other filter inputs.
            "flex h-9 min-w-[200px] flex-1 items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 focus:outline-hidden hover:enabled:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:ring-2 data-[state=open]:ring-slate-400 data-[state=open]:ring-offset-1"
          )}>
          <span className={cn("truncate", !value && "text-slate-500")} title={value || undefined}>
            {value || t("workspace.analysis.charts.select_value")}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden border-slate-300 p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onWheel={(event) => {
          const list = listRef.current;
          if (!list?.contains(event.target as Node)) return;

          const { scrollTop, scrollHeight, clientHeight } = list;
          const canScrollUp = scrollTop > 0;
          const canScrollDown = scrollTop + clientHeight < scrollHeight;

          if ((event.deltaY > 0 && canScrollDown) || (event.deltaY < 0 && canScrollUp)) {
            list.scrollTop += event.deltaY;
            event.preventDefault();
          }
        }}>
        <Command shouldFilter={false} className="overflow-hidden">
          <div className="shrink-0 border-b border-slate-200 px-3 py-2">
            <Input
              type="search"
              placeholder={t("workspace.analysis.charts.search_value")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-8 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div
            ref={listRef}
            id={listboxId}
            className="max-h-[280px] min-h-0 overflow-y-auto overscroll-contain p-1">
            <CommandList className="max-h-none overflow-visible border-0 bg-transparent p-0 shadow-none">
              {isLoading && (
                <div className="py-6">
                  <LoadingSpinner className="h-5 w-5" />
                </div>
              )}
              {!isLoading && error && (
                <div className="py-6 text-center text-sm text-red-500">{error.message}</div>
              )}
              {!isLoading && !error && (
                <CommandEmpty>{t("workspace.analysis.charts.no_values_found")}</CommandEmpty>
              )}
              {!isLoading && !error && values.length > 0 && (
                <CommandGroup className="overflow-visible">
                  {values.map((item) => {
                    const isSelected = value === item.value;

                    // Three columns: type icon, label, and the tick — which only renders when
                    // selected and sits on the right, so an unselected row spends none of its
                    // width on an empty checkmark gutter.
                    return (
                      <CommandItem
                        key={item.value}
                        value={item.value}
                        className="gap-2"
                        onSelect={() => {
                          onChange(item.value);
                          setOpen(false);
                        }}>
                        {showFieldTypeIcons && (
                          <FieldTypeIcon
                            fieldType={item.fieldType}
                            className={cn(
                              "size-4 shrink-0",
                              isSelected ? "text-slate-900" : "text-slate-500"
                            )}
                            aria-label={item.fieldType ? formatFieldTypeLabel(item.fieldType, t) : undefined}
                          />
                        )}
                        <span
                          className={cn("flex-1 truncate", isSelected && "font-medium text-slate-900")}
                          title={item.value}>
                          {item.value}
                        </span>
                        {isSelected && <CheckIcon className="ml-auto size-4 shrink-0" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
