"use client";

import { CheckIcon, ChevronDownIcon, SparklesIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/modules/ui/components/command";
import { Input } from "@/modules/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { cn } from "@/modules/ui/lib/utils";

interface FilterFieldOption {
  value: string;
  label: string;
  isGenerated?: boolean;
}

interface FilterFieldComboboxProps {
  options: FilterFieldOption[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * Searchable pick-list for the left (field) operand of a filter row.
 * Mirrors the structure of FilterValueCombobox but filters purely client-side
 * since the field list is static and small.
 */
export function FilterFieldCombobox({ options, value, onChange }: Readonly<FilterFieldComboboxProps>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const trimmedSearch = search.trim().toLowerCase();
  const filtered = trimmedSearch
    ? options.filter((opt) => opt.label.toLowerCase().includes(trimmedSearch))
    : options;

  const selectedLabel = options.find((opt) => opt.value === value)?.label;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        // Clear the search term when the popover closes.
        if (!nextOpen) setSearch("");
      }}>
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
            "flex h-9 w-[200px] items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 focus:outline-hidden hover:enabled:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:ring-2 data-[state=open]:ring-slate-400 data-[state=open]:ring-offset-1"
          )}>
          <span className={cn("truncate", !selectedLabel && "text-slate-500")} title={selectedLabel}>
            {selectedLabel ?? t("workspace.analysis.charts.select_field")}
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
              placeholder={t("workspace.analysis.charts.search_field")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-8 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div
            ref={listRef}
            id={listboxId}
            className="max-h-[200px] min-h-0 overflow-y-auto overscroll-contain p-1">
            <CommandList className="max-h-none overflow-visible border-0 bg-transparent p-0 shadow-none">
              {filtered.length === 0 && (
                <CommandEmpty>{t("workspace.analysis.charts.no_fields_found")}</CommandEmpty>
              )}
              {filtered.length > 0 && (
                <CommandGroup className="overflow-visible">
                  {filtered.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}>
                      <CheckIcon
                        className={cn(
                          "mr-2 size-4 shrink-0",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex items-center gap-1.5 truncate" title={option.label}>
                        {option.isGenerated && (
                          <SparklesIcon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
                        )}
                        {option.label}
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
