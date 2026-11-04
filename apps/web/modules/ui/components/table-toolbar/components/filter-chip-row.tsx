"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { getChipParts } from "../lib/chip-label";
import {
  isQuickFilter,
  removeFilterAt,
  setDateQuickFilter,
  toggleQuickFilterValue,
} from "../lib/filter-state";
import type { TFilterProperty, TLockedFilters, TTableFilter } from "../lib/types";
import { DateFilterEditor } from "./date-filter-editor";
import { FilterChip } from "./filter-chip";
import { FilterValueList } from "./filter-value-list";

/** One quick filter's chip, whose body reopens that filter's values in place. */
const QuickFilterChip = ({
  filter,
  property,
  filters,
  index,
  onFiltersChange,
  disabled,
}: Readonly<{
  filter: TTableFilter;
  property: TFilterProperty;
  filters: readonly TTableFilter[];
  index: number;
  onFiltersChange: (filters: TTableFilter[]) => void;
  disabled?: boolean;
}>) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const parts = getChipParts(filter, property, t, i18n.resolvedLanguage ?? i18n.language ?? "en-US");

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <FilterChip
          {...parts}
          disabled={disabled}
          onRemove={() => onFiltersChange(removeFilterAt(filters, index))}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1">
        {property.valueType === "date" ? (
          <DateFilterEditor
            property={property}
            filter={filter}
            onChange={(next) => {
              onFiltersChange(setDateQuickFilter(filters, property.id, next));
              setIsOpen(false);
            }}
          />
        ) : (
          <FilterValueList
            property={property}
            selected={filter.values}
            onToggle={(value) => onFiltersChange(toggleQuickFilterValue(filters, property.id, value))}
          />
        )}
      </PopoverContent>
    </Popover>
  );
};

/**
 * The bar under the toolbar, shown while at least one filter is active: one chip per filter, `+` to
 * add another, and Clear all. Chips wrap; the page never scrolls sideways.
 */
export const FilterChipRow = ({
  properties,
  filters,
  onFiltersChange,
  onAddFilter,
  onEditRules,
  locked,
  disabled,
}: Readonly<{
  properties: readonly TFilterProperty[];
  filters: readonly TTableFilter[];
  onFiltersChange: (filters: TTableFilter[]) => void;
  onAddFilter: () => void;
  onEditRules?: () => void;
  locked?: TLockedFilters;
  disabled?: boolean;
}>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const propertyById = new Map(properties.map((property) => [property.id, property]));

  const lockedFilters = locked?.filters ?? [];
  if (filters.length === 0 && lockedFilters.length === 0) return null;

  return (
    <div
      className="flex items-start justify-between gap-2 rounded-lg bg-slate-100 px-2 py-1.5"
      data-testid="table-filter-chips">
      <ul
        className="flex min-w-0 flex-wrap items-center gap-1.5"
        aria-label={t("common.table_toolbar.active_filters")}>
        {lockedFilters.map((filter, index) => {
          // A locked filter can be on a property this person cannot filter by themselves: named by its own
          // label then, and read as text.
          const property = propertyById.get(filter.property) ?? {
            id: filter.property,
            label: locked?.labels?.[index] ?? filter.property,
            valueType: "string" as const,
          };
          const parts = getChipParts(filter, property, t, locale);
          const onRemoveLocked = locked?.onRemove;
          return (
            <li key={`locked-${filter.property}-${filter.operator}-${index}`} className="max-w-full">
              <FilterChip
                {...parts}
                lockedHint={locked?.hint}
                disabled={disabled}
                onRemove={onRemoveLocked ? () => onRemoveLocked(index) : undefined}
              />
            </li>
          );
        })}
        {lockedFilters.length > 0 && filters.length > 0 && (
          <li aria-hidden="true" className="mx-0.5 h-5 w-px bg-slate-300" />
        )}
        {filters.map((filter, index) => {
          const property = propertyById.get(filter.property);
          if (!property) return null;
          const key = `${filter.property}-${filter.operator}-${index}`;
          if (isQuickFilter(filter)) {
            return (
              <li key={key} className="max-w-full">
                <QuickFilterChip
                  filter={filter}
                  property={property}
                  filters={filters}
                  index={index}
                  onFiltersChange={onFiltersChange}
                  disabled={disabled}
                />
              </li>
            );
          }
          const parts = getChipParts(filter, property, t, locale);
          return (
            <li key={key} className="max-w-full">
              <FilterChip
                {...parts}
                disabled={disabled}
                onClick={onEditRules}
                onRemove={() => onFiltersChange(removeFilterAt(filters, index))}
              />
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onAddFilter}
            disabled={disabled}
            aria-label={t("common.table_toolbar.add_filter")}
            className="focus-visible:ring-ring flex size-7 items-center justify-center rounded-md text-slate-600 hover:bg-white hover:text-slate-900 focus-visible:ring-1 focus-visible:outline-hidden">
            <PlusIcon className="size-4" />
          </button>
        </li>
      </ul>
      {filters.length > 0 && (
        <button
          type="button"
          onClick={() => onFiltersChange([])}
          disabled={disabled}
          className="focus-visible:ring-ring h-7 shrink-0 rounded-md px-2 text-xs font-medium text-slate-800 hover:bg-white focus-visible:ring-1 focus-visible:outline-hidden">
          {t("common.clear_all")}
        </button>
      )}
    </div>
  );
};
