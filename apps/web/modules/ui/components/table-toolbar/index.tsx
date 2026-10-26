"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { AdvancedFilterDialog } from "./components/advanced-filter-dialog";
import { FilterChipRow } from "./components/filter-chip-row";
import { FilterMenu } from "./components/filter-menu";
import { type TTableSettingsProps, TableSettingsPopover } from "./components/table-settings-popover";
import type { TFilterProperty, TTableFilter } from "./lib/types";

export type { TTableColumnSetting, TTableToggleSetting } from "./components/table-settings-popover";
export { ListTable } from "./components/list-table";
export { TableNoMatch } from "./components/table-no-match";
export type { TFilterOption, TFilterProperty, TSortOption, TTableFilter } from "./lib/types";

const SEARCH_DEBOUNCE_MS = 300;

/** Search that keeps its own text while typing and reports it once the user pauses. */
const ToolbarSearch = ({
  value,
  onChange,
  placeholder,
}: Readonly<{ value: string; onChange: (value: string) => void; placeholder?: string }>) => {
  const { t } = useTranslation();
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);

  // An outside change (Clear all, back navigation) replaces what is in the box. Adjusted while
  // rendering rather than in an effect, so the box never shows the stale text for a frame.
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  useEffect(() => {
    if (text === value) return;
    const timeout = setTimeout(() => onChange(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a change of the typed text schedules a write
  }, [text]);

  return (
    <div className="flex h-8 w-44 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 focus-within:ring-1 focus-within:ring-slate-400 sm:w-56">
      <SearchIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder ?? t("common.search")}
        aria-label={placeholder ?? t("common.search")}
        className="h-full w-full min-w-0 border-none bg-transparent p-0 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-hidden [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText("");
            onChange("");
          }}
          aria-label={t("common.table_toolbar.clear_search")}
          className="text-slate-400 hover:text-slate-700">
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
};

export type TTableToolbarProps = {
  settings?: TTableSettingsProps;
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  filter?: {
    properties: readonly TFilterProperty[];
    filters: readonly TTableFilter[];
    onFiltersChange: (filters: TTableFilter[]) => void;
  };
  /** Rows matching the filters, not rows loaded. Null while unknown. */
  matchCount?: { count: number | null; isCapped?: boolean };
  /** Page actions on the right: import, refresh, create. */
  actions?: ReactNode;
  /** Shown instead of the controls while rows are selected (bulk actions). */
  selectionContent?: ReactNode;
  isLoading?: boolean;
  className?: string;
};

/**
 * The one control bar every list table shares (GLOSSARY: Table toolbar): gear, search, Filter, match
 * count and page actions, with the active filters as chips underneath. State lives with the caller —
 * normally `useTableUrlState`, so the URL carries it.
 */
export const TableToolbar = ({
  settings,
  search,
  filter,
  matchCount,
  actions,
  selectionContent,
  isLoading,
  className,
}: Readonly<TTableToolbarProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const hasRuleProperties = Boolean(
    filter?.properties.some((property) => !property.hidden && (property.ruleOperators?.length ?? 0) > 0)
  );
  const hasQuickProperties = Boolean(
    filter?.properties.some((property) => property.quick && !property.hidden)
  );

  // View switches (Show archived) ride in the same filter list for the URL, but the menu, the chips and
  // Advanced filter only ever see — and only ever replace — the filters a user set there.
  const hiddenIds = new Set(filter?.properties.filter((p) => p.hidden).map((p) => p.id) ?? []);
  const visibleProperties = filter?.properties.filter((property) => !property.hidden) ?? [];
  const visibleFilters = filter?.filters.filter((f) => !hiddenIds.has(f.property)) ?? [];
  const hiddenFilters = filter?.filters.filter((f) => hiddenIds.has(f.property)) ?? [];
  const onVisibleFiltersChange = (next: TTableFilter[]) =>
    filter?.onFiltersChange([...hiddenFilters, ...next]);

  let countText: string | null = null;
  if (matchCount && matchCount.count !== null) {
    const formattedCount = new Intl.NumberFormat(locale).format(matchCount.count);
    countText = matchCount.isCapped
      ? t("common.table_toolbar.result_count_capped", { formattedCount })
      : t("common.table_toolbar.result_count", { count: matchCount.count, formattedCount });
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        {selectionContent ? (
          <div className="flex min-w-0 items-center">{selectionContent}</div>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            {settings && <TableSettingsPopover {...settings} />}
            {search && <ToolbarSearch {...search} />}
            {filter && (hasQuickProperties || hasRuleProperties) && (
              <FilterMenu
                properties={visibleProperties}
                filters={visibleFilters}
                onFiltersChange={onVisibleFiltersChange}
                onOpenAdvancedFilter={hasRuleProperties ? () => setIsAdvancedOpen(true) : undefined}
                open={isFilterMenuOpen}
                onOpenChange={setIsFilterMenuOpen}
              />
            )}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-3">
          {countText && (
            <span
              className="text-sm whitespace-nowrap text-slate-500"
              aria-live="polite"
              data-testid="table-match-count">
              {countText}
            </span>
          )}
          {actions}
        </div>
      </div>

      {filter && (
        <FilterChipRow
          properties={visibleProperties}
          filters={visibleFilters}
          onFiltersChange={onVisibleFiltersChange}
          onAddFilter={() => setIsFilterMenuOpen(true)}
          onEditRules={hasRuleProperties ? () => setIsAdvancedOpen(true) : undefined}
          disabled={isLoading}
        />
      )}

      {filter && isAdvancedOpen && (
        <AdvancedFilterDialog
          open={isAdvancedOpen}
          onOpenChange={setIsAdvancedOpen}
          properties={visibleProperties}
          filters={visibleFilters}
          onFiltersChange={onVisibleFiltersChange}
        />
      )}
    </div>
  );
};
