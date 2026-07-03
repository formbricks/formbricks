"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getDimensionValuesAction } from "@/modules/ee/analysis/charts/actions";
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

/**
 * Pick-list for a filter value, backed by the distinct stored values of a low-cardinality
 * string dimension. Selecting a real stored value guarantees an exact match for the
 * `equals` / `notEquals` operators (no casing/whitespace drift). Search narrows results
 * server-side so dimensions with more than the lookup cap stay usable.
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
  const [values, setValues] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the latest in-flight lookup may apply its result.
  const seqRef = useRef(0);
  // Stale-while-revalidate cache: previously fetched values per lookup key, kept for the
  // lifetime of the filter row so reopening the popover shows the list instantly while a
  // background refresh picks up any new values.
  const cacheRef = useRef(new Map<string, string[]>());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const seq = ++seqRef.current;
    const trimmedSearch = search.trim();
    const cacheKey = JSON.stringify([workspaceId, feedbackDirectoryId, dimension, trimmedSearch]);
    const cached = cacheRef.current.get(cacheKey);

    setError(null);
    if (cached) {
      setValues(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    const fetchValues = () => {
      void getDimensionValuesAction({
        workspaceId,
        feedbackDirectoryId,
        dimension,
        ...(trimmedSearch ? { search: trimmedSearch } : {}),
      }).then((result) => {
        if (seq !== seqRef.current) return;

        if (result?.serverError || result?.validationErrors) {
          // A failed background refresh keeps showing the cached list; only surface the
          // error when there is nothing to show instead.
          if (!cached) {
            setError(getFormattedErrorMessage(result));
            setValues([]);
          }
        } else {
          const nextValues = Array.isArray(result?.data) ? result.data : [];
          cacheRef.current.set(cacheKey, nextValues);
          setValues(nextValues);
        }
        setIsLoading(false);
      });
    };

    // Debounce only narrows typed searches; the initial open fetches immediately.
    if (!trimmedSearch) {
      fetchValues();
      return;
    }

    const timer = setTimeout(fetchValues, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, search, workspaceId, feedbackDirectoryId, dimension]);

  // Reset the transient search term whenever the popover closes.
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              setOpen(false);
            }
          }}
          className={cn(
            "flex h-9 w-[200px] items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 focus:outline-hidden hover:enabled:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:ring-2 data-[state=open]:ring-slate-400 data-[state=open]:ring-offset-1"
          )}>
          <span className={cn("truncate", !value && "text-slate-500")} title={value || undefined}>
            {value || t("workspace.analysis.charts.select_value")}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] overflow-hidden border-slate-300 p-0"
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
          <div ref={listRef} className="max-h-[200px] min-h-0 overflow-y-auto overscroll-contain p-1">
            <CommandList className="max-h-none overflow-visible border-0 bg-transparent p-0 shadow-none">
              {isLoading && (
                <div className="py-6">
                  <LoadingSpinner className="h-5 w-5" />
                </div>
              )}
              {!isLoading && error && <div className="py-6 text-center text-sm text-red-500">{error}</div>}
              {!isLoading && !error && (
                <CommandEmpty>{t("workspace.analysis.charts.no_values_found")}</CommandEmpty>
              )}
              {!isLoading && !error && values.length > 0 && (
                <CommandGroup className="overflow-visible">
                  {values.map((item) => (
                    <CommandItem
                      key={item}
                      value={item}
                      onSelect={() => {
                        onChange(item);
                        setOpen(false);
                      }}>
                      <CheckIcon
                        className={cn("mr-2 size-4", value === item ? "opacity-100" : "opacity-0")}
                      />
                      <span className="truncate" title={item}>
                        {item}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
