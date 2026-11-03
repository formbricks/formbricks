"use client";

import { ChevronDownIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getFilterOperatorLabel } from "@/modules/ee/analysis/charts/lib/filter-conditions";
import { type TChartDateRangeInput, listDashboardFilterValues } from "@/modules/ee/analysis/lib/api-client";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { FilterValueList } from "@/modules/ui/components/table-toolbar/components/filter-value-list";
import { cn } from "@/modules/ui/lib/utils";
import {
  type TDashboardFilter,
  type TDashboardFilterPicks,
  getDashboardFilterField,
  isListDashboardFilter,
} from "../lib/dashboard-filters";

interface DashboardFilterControlProps {
  dashboardId: string;
  filter: TDashboardFilter;
  /** Every pick on the dashboard: the other filters' narrow this one's value list. */
  picks: TDashboardFilterPicks;
  dateRange: TChartDateRangeInput | null;
  onChange: (values: string[]) => void;
}

/** "A", "A, B", or "A +2": what a picked filter's trigger shows. */
const summarize = (values: readonly string[]): string =>
  values.length <= 2 ? values.join(", ") : `${values[0]} +${values.length - 1}`;

/** The one value a typed filter takes, applied on Enter or with the button. */
const TypedValueEditor = ({
  filter,
  value,
  onApply,
}: Readonly<{ filter: TDashboardFilter; value: string; onApply: (value: string) => void }>) => {
  const { t } = useTranslation();
  // Mounted each time the popover opens, so the draft starts from the current pick.
  const [draft, setDraft] = useState(value);
  const type = getDashboardFilterField(filter.field)?.type;

  return (
    <form
      className="flex w-64 flex-col gap-2 p-2"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft.trim());
      }}>
      <span className="text-xs text-slate-500">{getFilterOperatorLabel(filter.operator, t)}</span>
      <Input
        type={type === "number" ? "number" : type === "time" ? "date" : "text"}
        value={draft}
        aria-label={filter.label}
        placeholder={t("workspace.analysis.charts.enter_value")}
        onChange={(event) => setDraft(event.target.value)}
        className="bg-white"
      />
      <Button type="submit" size="sm">
        {t("workspace.analysis.dashboards.filter_apply")}
      </Button>
    </form>
  );
};

/**
 * One dashboard filter in the top bar, as a person picks its value: a list filter offers the values the
 * dashboard's charts let through, loaded when it opens; any other filter takes one typed value. The trigger
 * looks like the date range beside it; a picked filter shows its values and a button to clear them.
 */
export const DashboardFilterControl = ({
  dashboardId,
  filter,
  picks,
  dateRange,
  onChange,
}: Readonly<DashboardFilterControlProps>) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = picks[filter.id] ?? [];
  const isList = isListDashboardFilter(filter);
  const { [filter.id]: _own, ...otherPicks } = picks;

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div className="relative flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              // Matches the date range select beside it, so the bar reads as one row of controls.
              "flex h-10 max-w-64 min-w-36 items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:border-slate-400 focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 focus:outline-hidden data-[state=open]:ring-2 data-[state=open]:ring-slate-400 data-[state=open]:ring-offset-1",
              selected.length > 0 && "pr-8"
            )}>
            <span
              className="truncate"
              title={selected.length > 0 ? `${filter.label}: ${selected.join(", ")}` : filter.label}>
              <span className={cn(selected.length === 0 && "text-slate-500")}>{filter.label}</span>
              {selected.length > 0 && (
                <span className="font-medium text-slate-900">: {summarize(selected)}</span>
              )}
            </span>
            {selected.length === 0 && <ChevronDownIcon className="size-4 shrink-0 opacity-50" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-1">
          {isList ? (
            <FilterValueList
              property={{
                // The list depends on the other picks and the date range, so they are part of its identity.
                id: JSON.stringify(["dashboard-filter", dashboardId, filter.id, otherPicks, dateRange]),
                label: filter.label,
                valueType: "enum",
                loadOptions: async (search) =>
                  (
                    await listDashboardFilterValues({
                      dashboardId,
                      filterId: filter.id,
                      dateRange: dateRange ?? undefined,
                      picks: otherPicks,
                      search: search || undefined,
                    })
                  ).values.map(({ value }) => ({ value, label: value })),
              }}
              selected={selected}
              onToggle={toggle}
            />
          ) : (
            <TypedValueEditor
              filter={filter}
              value={selected[0] ?? ""}
              onApply={(value) => {
                onChange(value ? [value] : []);
                setOpen(false);
              }}
            />
          )}
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          aria-label={t("common.table_toolbar.remove_filter", { filter: filter.label })}
          className="absolute right-2 flex size-5 items-center justify-center rounded text-slate-500 hover:text-slate-900 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden">
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
};
