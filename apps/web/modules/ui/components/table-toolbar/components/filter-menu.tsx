"use client";

import { FilterIcon, ListFilterIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import {
  getFixedValues,
  getQuickFilter,
  setDateQuickFilter,
  toggleQuickFilterValue,
} from "../lib/filter-state";
import type { TFilterProperty, TTableFilter } from "../lib/types";
import { DateFilterEditor } from "./date-filter-editor";
import { FilterValueList } from "./filter-value-list";

/**
 * The Filter button and its menu: one submenu per quick filter, then Advanced filter. The button shows
 * how many filters are active; the chips under the toolbar show which.
 */
export const FilterMenu = ({
  properties,
  filters,
  onFiltersChange,
  onOpenAdvancedFilter,
  open,
  onOpenChange,
}: Readonly<{
  properties: readonly TFilterProperty[];
  filters: readonly TTableFilter[];
  onFiltersChange: (filters: TTableFilter[]) => void;
  /** Absent when the table has no property Advanced filter can use. */
  onOpenAdvancedFilter?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}>) => {
  const { t } = useTranslation();
  const quickProperties = properties.filter((property) => property.quick);
  const activeCount = filters.length;
  const isActive = activeCount > 0;
  const buttonLabel = isActive
    ? t("common.table_toolbar.filter_with_count", { count: activeCount })
    : t("common.filter");

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={buttonLabel}
          title={buttonLabel}
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
      {/* The property list scrolls on its own so Advanced filter stays reachable with many properties. */}
      <DropdownMenuContent align="start" className="flex w-52 flex-col overflow-hidden p-0">
        <div className="min-h-0 overflow-y-auto p-1">
          <DropdownMenuLabel className="text-xs font-semibold text-slate-800">
            {t("common.filter")}
          </DropdownMenuLabel>
          {quickProperties.map((property) => {
            const current = getQuickFilter(filters, property.id);
            return (
              <DropdownMenuSub key={property.id}>
                <DropdownMenuSubTrigger className="font-normal text-slate-700">
                  <span className="truncate">{property.label}</span>
                  {current && (
                    <span className="ml-auto pl-2 text-xs text-slate-500">
                      {current.operator === "in" ? current.values.length : 1}
                    </span>
                  )}
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
                      onToggle={(value) =>
                        onFiltersChange(
                          toggleQuickFilterValue(filters, property.id, value, getFixedValues(property))
                        )
                      }
                    />
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          })}
        </div>
        {onOpenAdvancedFilter && (
          <div className={cn("shrink-0 p-1", quickProperties.length > 0 && "border-t border-slate-200")}>
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
