"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getDimensionValuesAction } from "@/modules/ee/analysis/charts/actions";
import { Button } from "@/modules/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/modules/ui/components/command";
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

  useEffect(() => {
    if (!open) return;

    const seq = ++seqRef.current;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      const trimmedSearch = search.trim();
      void getDimensionValuesAction({
        workspaceId,
        feedbackDirectoryId,
        dimension,
        ...(trimmedSearch ? { search: trimmedSearch } : {}),
      }).then((result) => {
        if (seq !== seqRef.current) return;

        if (result?.serverError || result?.validationErrors) {
          setError(getFormattedErrorMessage(result));
          setValues([]);
        } else {
          setValues(Array.isArray(result?.data) ? result.data : []);
        }
        setIsLoading(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [open, search, workspaceId, feedbackDirectoryId, dimension]);

  // Reset the transient search term whenever the popover closes.
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between bg-white font-normal">
          <span className={cn("truncate", !value && "text-slate-500")}>
            {value || t("workspace.analysis.charts.select_value")}
          </span>
          <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("workspace.analysis.charts.search_value")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading && (
              <div className="py-6 text-center text-sm text-slate-500">{t("common.loading")}</div>
            )}
            {!isLoading && error && <div className="py-6 text-center text-sm text-red-500">{error}</div>}
            {!isLoading && !error && (
              <CommandEmpty>{t("workspace.analysis.charts.no_values_found")}</CommandEmpty>
            )}
            {!isLoading && !error && values.length > 0 && (
              <CommandGroup>
                {values.map((item) => (
                  <CommandItem
                    key={item}
                    value={item}
                    onSelect={() => {
                      onChange(item);
                      setOpen(false);
                    }}>
                    <CheckIcon className={cn("mr-2 size-4", value === item ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{item}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
