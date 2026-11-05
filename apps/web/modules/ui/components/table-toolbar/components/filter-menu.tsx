"use client";

import { FilterIcon, ListFilterIcon, PlusIcon, SearchIcon } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useAvailableValues } from "../hooks/use-available-values";
import {
  getLockedQuickValues,
  getQuickFilter,
  setDateQuickFilter,
  toggleQuickFilterValue,
} from "../lib/filter-state";
import { groupFilterProperties, isMenuProperty, searchMenuProperties, startsRule } from "../lib/simple-rule";
import type { TFilterProperty, TLockedFilters, TTableFilter } from "../lib/types";
import { DateFilterEditor } from "./date-filter-editor";
import { FilterValueList } from "./filter-value-list";

/** How many values a quick filter holds, its locked ones included: a date filter counts as one. */
const countQuickValues = (current: TTableFilter | undefined, lockedValues: readonly string[]): number => {
  const lockedOnly = lockedValues.filter((value) => !current?.values.includes(value)).length;
  if (!current) return lockedOnly;
  return (current.operator === "in" ? current.values.length : 1) + lockedOnly;
};

/** A property's icon, sized for a menu row. */
const PropertyIcon = ({ property }: Readonly<{ property: TFilterProperty }>) => {
  const Icon = property.icon;
  return Icon ? <Icon className="size-4 shrink-0 text-slate-500" aria-hidden="true" /> : null;
};

/**
 * A property that has no values to filter by (`availableValues` found none): listed, but disabled, with
 * why under its name.
 */
const EmptyPropertyItem = ({
  property,
  showIcon,
}: Readonly<{ property: TFilterProperty; showIcon?: boolean }>) => (
  <DropdownMenuItem
    disabled
    icon={showIcon ? <PropertyIcon property={property} /> : undefined}
    className="gap-2 font-normal text-slate-700">
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{property.label}</span>
      <span className="text-xs text-slate-500">{property.availableValues?.emptyHint}</span>
    </span>
  </DropdownMenuItem>
);

/** Whether the property is known to have no values at all, and nothing set on it to take off. */
const useHasNoValues = (property: TFilterProperty, isSet: boolean): boolean => {
  const available = useAvailableValues(property);
  return !isSet && available !== null && available.size === 0;
};

/** One quick filter's submenu: its values to tick, or its date presets and range. */
const QuickFilterSubmenu = ({
  property,
  filters,
  onFiltersChange,
  locked,
  showIcon,
}: Readonly<{
  property: TFilterProperty;
  filters: readonly TTableFilter[];
  onFiltersChange: (filters: TTableFilter[]) => void;
  locked?: TLockedFilters;
  showIcon?: boolean;
}>) => {
  const current = getQuickFilter(filters, property.id);
  const lockedValues = getLockedQuickValues(locked?.filters ?? [], property.id);
  const count = countQuickValues(current, lockedValues);
  const hasNoValues = useHasNoValues(property, count > 0);
  if (hasNoValues) return <EmptyPropertyItem property={property} showIcon={showIcon} />;
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2 font-normal text-slate-700">
        {showIcon && <PropertyIcon property={property} />}
        <span className="truncate">
          {property.label}
          {count > 0 && <span className="font-semibold text-slate-900">{` (${count})`}</span>}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-none p-1">
        {property.valueType === "date" ? (
          <DateFilterEditor
            property={property}
            filter={current}
            onChange={(next) => onFiltersChange(setDateQuickFilter(filters, property.id, next))}
          />
        ) : (
          <FilterValueList
            property={property}
            selected={current?.values ?? []}
            locked={lockedValues}
            lockedHint={locked?.valueHint ?? locked?.hint}
            onToggle={(value) => onFiltersChange(toggleQuickFilterValue(filters, property.id, value))}
          />
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

/**
 * The search box over the simple-first menu's properties. Typed characters stay in the box rather than
 * jumping the menu's focus; ArrowDown moves on to the first property.
 */
const PropertySearch = ({
  value,
  onChange,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
}>) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  // The menu focuses itself as it opens; the box takes focus right after, so typing searches at once.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.currentTarget.closest("[role=menu]")?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
      return;
    }
    if (event.key.length === 1) event.stopPropagation();
  };
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-1.5">
      <SearchIcon className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onKeyDown={handleKeyDown}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("common.search")}
        aria-label={t("common.table_toolbar.search_fields")}
        className="h-7 w-full border-none bg-transparent p-0 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-hidden"
      />
    </div>
  );
};

/** A property that starts a rule on its chip, or lies disabled when it has no values to filter by. */
const RulePropertyItem = ({
  property,
  isSet,
  onPick,
}: Readonly<{ property: TFilterProperty; isSet: boolean; onPick: (propertyId: string) => void }>) => {
  const hasNoValues = useHasNoValues(property, isSet);
  if (hasNoValues) return <EmptyPropertyItem property={property} showIcon />;
  return (
    <DropdownMenuItem
      icon={<PropertyIcon property={property} />}
      className="gap-2 font-normal text-slate-700"
      onSelect={() => onPick(property.id)}>
      <span className="truncate">{property.label}</span>
    </DropdownMenuItem>
  );
};

/** The simple-first menu's list: every property, searched and under its group's heading. */
const GroupedProperties = ({
  properties,
  search,
  onPickRuleProperty,
  ...quick
}: Readonly<{
  properties: readonly TFilterProperty[];
  search: string;
  onPickRuleProperty: (propertyId: string) => void;
  filters: readonly TTableFilter[];
  onFiltersChange: (filters: TTableFilter[]) => void;
  locked?: TLockedFilters;
}>) => {
  const { t } = useTranslation();
  const groups = groupFilterProperties(
    searchMenuProperties(properties.filter(isMenuProperty), search),
    t("common.table_toolbar.properties")
  );
  if (groups.length === 0) {
    return <p className="px-2 py-2 text-xs text-slate-500">{t("common.no_results")}</p>;
  }
  return groups.map((group) => (
    <DropdownMenuGroup key={group.label} aria-label={group.label}>
      <DropdownMenuLabel className="text-xs font-semibold text-slate-500">{group.label}</DropdownMenuLabel>
      {group.properties.map((property) =>
        startsRule(property) ? (
          <RulePropertyItem
            key={property.id}
            property={property}
            isSet={quick.filters.some((filter) => filter.property === property.id)}
            onPick={onPickRuleProperty}
          />
        ) : (
          <QuickFilterSubmenu key={property.id} property={property} showIcon {...quick} />
        )
      )}
    </DropdownMenuGroup>
  ));
};

/**
 * The Filter button and its menu: one submenu per quick filter, then Advanced filter. The button shows
 * how many filters are active, the locked ones included; the chips under the toolbar show which. A locked
 * quick filter's values show ticked and locked in its submenu, so they are not ticked again.
 *
 * With `onPickRuleProperty` (TableToolbar `filter.simpleRules`) the menu is simple-first: a search box,
 * then every property under its group, quick filters as before and the rest starting a rule on its chip.
 */
export const FilterMenu = ({
  properties,
  filters,
  onFiltersChange,
  onOpenAdvancedFilter,
  onPickRuleProperty,
  open,
  onOpenChange,
  locked,
}: Readonly<{
  properties: readonly TFilterProperty[];
  filters: readonly TTableFilter[];
  onFiltersChange: (filters: TTableFilter[]) => void;
  /** Absent when the table has no property Advanced filter can use. */
  onOpenAdvancedFilter?: () => void;
  /** Simple-first: picking a rule property starts a rule on its own chip. */
  onPickRuleProperty?: (propertyId: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Filters set for everyone: counted on the button, and shown locked in their quick filter's list. */
  locked?: TLockedFilters;
}>) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  // A picked rule property opens its chip's popover: focus goes there, not back to the Filter button.
  const pickedRuleRef = useRef(false);
  const quickProperties = properties.filter((property) => property.quick);
  const lockedFilters = locked?.filters ?? [];
  const activeCount = filters.length + lockedFilters.length;
  const isActive = activeCount > 0;
  const isSimple = Boolean(onPickRuleProperty);
  const buttonLabel = isActive
    ? t("common.table_toolbar.filter_with_count", { count: activeCount })
    : t("common.filter");

  const handleOpenChange = (next: boolean) => {
    if (next) setSearch("");
    onOpenChange?.(next);
  };

  const pickRuleProperty = (propertyId: string) => {
    pickedRuleRef.current = true;
    onPickRuleProperty?.(propertyId);
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <TooltipRenderer tooltipContent={buttonLabel} triggerClass="flex">
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={buttonLabel}
            data-testid="table-filter-button"
            className={cn(
              "relative size-8 shrink-0 bg-white",
              isActive &&
                "border-slate-900 bg-slate-900 text-white not-disabled:hover:bg-slate-800 not-disabled:hover:text-white"
            )}>
            {isActive ? <ListFilterIcon /> : <FilterIcon />}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border border-slate-900 bg-white text-[10px] leading-none font-semibold text-slate-900">
                {activeCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
      </TooltipRenderer>
      {/* The property list scrolls on its own so Advanced filter stays reachable with many properties. */}
      <DropdownMenuContent
        align="start"
        className={cn("flex flex-col overflow-hidden p-0", isSimple ? "w-64" : "w-52")}
        onCloseAutoFocus={(event) => {
          if (!pickedRuleRef.current) return;
          pickedRuleRef.current = false;
          event.preventDefault();
        }}>
        {isSimple && <PropertySearch value={search} onChange={setSearch} />}
        <div className="min-h-0 overflow-y-auto p-1">
          {onPickRuleProperty ? (
            <GroupedProperties
              properties={properties}
              search={search}
              onPickRuleProperty={pickRuleProperty}
              filters={filters}
              onFiltersChange={onFiltersChange}
              locked={locked}
            />
          ) : (
            <>
              <DropdownMenuLabel className="text-xs font-semibold text-slate-800">
                {t("common.filter")}
              </DropdownMenuLabel>
              {quickProperties.map((property) => (
                <QuickFilterSubmenu
                  key={property.id}
                  property={property}
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  locked={locked}
                />
              ))}
            </>
          )}
        </div>
        {onOpenAdvancedFilter && (
          <div
            className={cn(
              "shrink-0 p-1",
              (isSimple || quickProperties.length > 0) && "border-t border-slate-200"
            )}>
            <DropdownMenuItem
              icon={<PlusIcon className="size-4" />}
              className="font-normal text-slate-700"
              onSelect={() => onOpenAdvancedFilter()}>
              {t("common.table_toolbar.advanced_filter")}
            </DropdownMenuItem>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
