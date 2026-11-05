"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { getChipParts } from "../lib/chip-label";
import {
  getLockedQuickValues,
  isQuickFilter,
  removeFilterAt,
  replaceFilterAt,
  setDateQuickFilter,
  toggleQuickFilterValue,
} from "../lib/filter-state";
import { quickFilterAsRule, ruleAsQuickFilter } from "../lib/simple-rule";
import type { TFilterProperty, TLockedFilters, TTableFilter } from "../lib/types";
import { DateFilterEditor } from "./date-filter-editor";
import { FilterChip } from "./filter-chip";
import { FilterValueList } from "./filter-value-list";
import { RuleFilterChip } from "./rule-filter-chip";

/** One quick filter's chip, whose body reopens that filter's values in place. */
const QuickFilterChip = ({
  filter,
  property,
  filters,
  index,
  onFiltersChange,
  locked,
  disabled,
}: Readonly<{
  filter: TTableFilter;
  property: TFilterProperty;
  filters: readonly TTableFilter[];
  index: number;
  onFiltersChange: (filters: TTableFilter[]) => void;
  locked?: TLockedFilters;
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
            locked={getLockedQuickValues(locked?.filters ?? [], property.id)}
            lockedHint={locked?.valueHint ?? locked?.hint}
            onToggle={(value) => onFiltersChange(toggleQuickFilterValue(filters, property.id, value))}
          />
        )}
      </PopoverContent>
    </Popover>
  );
};

/** One rule's chip: reopens that rule alone in a popover with `simpleRules`, else Advanced filter. */
const RuleChip = ({
  filter,
  property,
  filters,
  index,
  onFiltersChange,
  onEditRules,
  simpleRules,
  toStored = (rule) => rule,
  disabled,
}: Readonly<{
  filter: TTableFilter;
  property: TFilterProperty;
  filters: readonly TTableFilter[];
  index: number;
  onFiltersChange: (filters: TTableFilter[]) => void;
  /** Opens Advanced filter, starting from `filters` when a chip has just saved its rule. */
  onEditRules?: (filters?: TTableFilter[]) => void;
  simpleRules?: boolean;
  /** How a saved rule is stored: as it is, or back as the quick filter it was opened from. */
  toStored?: (rule: TTableFilter) => TTableFilter;
  disabled?: boolean;
}>) => {
  const { t, i18n } = useTranslation();
  const onRemove = () => onFiltersChange(removeFilterAt(filters, index));
  if (simpleRules) {
    return (
      <RuleFilterChip
        property={property}
        rule={filter}
        disabled={disabled}
        onCommit={(rule) => onFiltersChange(replaceFilterAt(filters, index, toStored(rule)))}
        onRemove={onRemove}
        onOpenAdvancedFilter={
          onEditRules &&
          ((rule) => {
            if (!rule) return onEditRules();
            const next = replaceFilterAt(filters, index, toStored(rule));
            onFiltersChange(next);
            onEditRules(next);
          })
        }
      />
    );
  }
  const parts = getChipParts(filter, property, t, i18n.resolvedLanguage ?? i18n.language ?? "en-US");
  return (
    <FilterChip
      {...parts}
      disabled={disabled}
      onClick={onEditRules && (() => onEditRules())}
      onRemove={onRemove}
    />
  );
};

/**
 * The bar under the toolbar, shown while at least one filter is active: one chip per filter, `+` to
 * add another, and Clear all. Chips wrap; the page never scrolls sideways. `draftProperty` is a rule
 * just started from the Filter menu (`simpleRules`): its chip opens at once, and is saved only once
 * finished.
 */
export const FilterChipRow = ({
  properties,
  filters,
  onFiltersChange,
  onAddFilter,
  onEditRules,
  simpleRules,
  draftProperty,
  onDraftClose,
  locked,
  disabled,
}: Readonly<{
  properties: readonly TFilterProperty[];
  filters: readonly TTableFilter[];
  onFiltersChange: (filters: TTableFilter[]) => void;
  onAddFilter: () => void;
  /** Opens Advanced filter, starting from `filters` when a chip has just saved its rule. */
  onEditRules?: (filters?: TTableFilter[]) => void;
  simpleRules?: boolean;
  draftProperty?: TFilterProperty;
  onDraftClose?: () => void;
  locked?: TLockedFilters;
  disabled?: boolean;
}>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const propertyById = new Map(properties.map((property) => [property.id, property]));

  const lockedFilters = locked?.filters ?? [];
  if (filters.length === 0 && lockedFilters.length === 0 && !draftProperty) return null;

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
        {lockedFilters.length > 0 && (filters.length > 0 || draftProperty) && (
          <li aria-hidden="true" className="mx-0.5 h-5 w-px bg-slate-300" />
        )}
        {filters.map((filter, index) => {
          const property = propertyById.get(filter.property);
          if (!property) return null;
          // Keyed without the operator, so a chip whose operator is changed in its popover stays mounted
          // and keeps the focus.
          const key = `${filter.property}-${index}`;
          // With simple rules, a quick filter that means "is" any of its values opens as that rule, so
          // its popover offers the property's other operators too; saved as "is", it is ticked values again.
          const asRule = simpleRules ? quickFilterAsRule(property, filter) : null;
          if (asRule) {
            return (
              <li key={key} className="max-w-full">
                <RuleChip
                  filter={asRule}
                  property={property}
                  filters={filters}
                  index={index}
                  onFiltersChange={onFiltersChange}
                  onEditRules={onEditRules}
                  simpleRules
                  toStored={(rule) => ruleAsQuickFilter(property, rule)}
                  disabled={disabled}
                />
              </li>
            );
          }
          if (isQuickFilter(filter)) {
            return (
              <li key={key} className="max-w-full">
                <QuickFilterChip
                  filter={filter}
                  property={property}
                  filters={filters}
                  index={index}
                  onFiltersChange={onFiltersChange}
                  locked={locked}
                  disabled={disabled}
                />
              </li>
            );
          }
          return (
            <li key={key} className="max-w-full">
              <RuleChip
                filter={filter}
                property={property}
                filters={filters}
                index={index}
                onFiltersChange={onFiltersChange}
                onEditRules={onEditRules}
                simpleRules={simpleRules}
                disabled={disabled}
              />
            </li>
          );
        })}
        {draftProperty && (
          <li key={`draft-${draftProperty.id}`} className="max-w-full">
            <RuleFilterChip
              property={draftProperty}
              defaultOpen
              disabled={disabled}
              onCommit={(rule) => onFiltersChange([...filters, rule])}
              onRemove={() => onDraftClose?.()}
              onClose={onDraftClose}
              onOpenAdvancedFilter={
                onEditRules &&
                ((rule) => {
                  if (!rule) return onEditRules();
                  const next = [...filters, rule];
                  onFiltersChange(next);
                  onEditRules(next);
                })
              }
            />
          </li>
        )}
        <li>
          <button
            type="button"
            onClick={onAddFilter}
            disabled={disabled}
            data-filter-add=""
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
