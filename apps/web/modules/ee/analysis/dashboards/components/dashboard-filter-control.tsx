"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterDateInput } from "@/modules/ee/analysis/charts/components/filter-date-input";
import { getFilterOperatorLabel } from "@/modules/ee/analysis/charts/lib/filter-conditions";
import type { TChartDateRangeInput } from "@/modules/ee/analysis/lib/api-client";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { FilterChip } from "@/modules/ui/components/table-toolbar/components/filter-chip";
import { FilterValueList } from "@/modules/ui/components/table-toolbar/components/filter-value-list";
import { summarizePickedValues, toTypedPick, withoutOwnPick } from "../lib/dashboard-filter-editing";
import { getDashboardFilterValueProperty } from "../lib/dashboard-filter-values";
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

/**
 * The one value a typed filter takes, applied with the button: a day through the chart builder's date
 * input for a date field, a number or text otherwise.
 */
const TypedValueEditor = ({
  filter,
  value,
  onApply,
}: Readonly<{ filter: TDashboardFilter; value: string; onApply: (values: string[]) => void }>) => {
  const { t } = useTranslation();
  const inputId = useId();
  // Mounted each time the popover opens, so the draft starts from the current pick.
  const [draft, setDraft] = useState(value);
  const type = getDashboardFilterField(filter.field)?.type;

  return (
    <form
      className="flex w-64 flex-col gap-2 p-2"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(toTypedPick(draft));
      }}>
      <Label htmlFor={type === "time" ? undefined : inputId}>
        {filter.label} {getFilterOperatorLabel(filter.operator, t)}
      </Label>
      {type === "time" ? (
        <FilterDateInput value={draft} onChange={(next) => setDraft(next ?? "")} />
      ) : (
        <Input
          id={inputId}
          type={type === "number" ? "number" : "text"}
          value={draft}
          placeholder={t("workspace.analysis.charts.enter_value")}
          onChange={(event) => setDraft(event.target.value)}
          className="bg-white"
        />
      )}
      <Button type="submit" size="sm">
        {t("workspace.analysis.dashboards.filter_apply")}
      </Button>
    </form>
  );
};

/**
 * One dashboard filter in the top bar, as a person picks its value: a list filter offers the values the
 * dashboard's charts let through, loaded when it opens; any other filter takes one typed value. It is the
 * table toolbar's filter chip at the height of the date range beside it, the same chip edit mode shows.
 */
export const DashboardFilterControl = ({
  dashboardId,
  filter,
  picks,
  dateRange,
  onChange,
}: Readonly<DashboardFilterControlProps>) => {
  const [open, setOpen] = useState(false);
  const selected = picks[filter.id] ?? [];
  const isList = isListDashboardFilter(filter);
  const otherPicks = withoutOwnPick(picks, filter.id);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterChip
          size="md"
          label={filter.label}
          value={summarizePickedValues(selected)}
          accessibleName={filter.label}
          onRemove={selected.length > 0 ? () => onChange([]) : undefined}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1">
        {isList ? (
          <FilterValueList
            property={getDashboardFilterValueProperty({ dashboardId, filter, otherPicks, dateRange })}
            selected={selected}
            onToggle={toggle}
          />
        ) : (
          <TypedValueEditor
            filter={filter}
            value={selected[0] ?? ""}
            onApply={(values) => {
              onChange(values);
              setOpen(false);
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
};
