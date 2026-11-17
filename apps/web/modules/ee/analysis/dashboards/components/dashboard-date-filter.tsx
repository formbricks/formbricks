"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DATE_RANGE_PRESETS, type TDateRangePreset } from "@/lib/date-ranges";
import { formatLocalDay, parseLocalDay } from "@/lib/utils/datetime";
import { getTranslatedDatePresetLabel } from "@/modules/ee/analysis/lib/schema-definition";
import { Button } from "@/modules/ui/components/button";
import { DateRangePicker } from "@/modules/ui/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import {
  ALL_TIME_VALUE,
  CUSTOM_VALUE,
  DEFAULT_VALUE,
  type TDashboardDateFilter,
  isDashboardDefaultDateRange,
} from "../lib/dashboard-date-filter";

interface DashboardDateFilterProps {
  /** The range this viewer picked (URL or remembered); `null` when the dashboard's default applies. */
  value: TDashboardDateFilter | null;
  onChange: (filter: TDashboardDateFilter | null) => void;
  /** The dashboard's saved default rolling range, if any. */
  defaultDateRange?: TDateRangePreset | null;
  /** Save (`preset`) or clear (`null`) the default. Omitted for people who cannot edit the dashboard. */
  onDefaultDateRangeChange?: (preset: TDateRangePreset | null) => void;
  isSavingDefault?: boolean;
}

export const DashboardDateFilter = ({
  value,
  onChange,
  defaultDateRange = null,
  onDefaultDateRangeChange,
  isSavingDefault = false,
}: Readonly<DashboardDateFilterProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  const [isCustomMode, setIsCustomMode] = useState(value?.type === "custom");
  const [customStart, setCustomStart] = useState<Date | null>(
    value?.type === "custom" ? parseLocalDay(value.range[0]) : null
  );
  const [customEnd, setCustomEnd] = useState<Date | null>(
    value?.type === "custom" ? parseLocalDay(value.range[1]) : null
  );

  // Query-only navigation (back/forward, or restoring a persisted filter) keeps this component
  // mounted, so re-sync the local custom-range state whenever the incoming value changes to keep
  // the UI aligned with the URL rather than showing stale bounds.
  useEffect(() => {
    if (value?.type === "custom") {
      setIsCustomMode(true);
      setCustomStart(parseLocalDay(value.range[0]));
      setCustomEnd(parseLocalDay(value.range[1]));
    } else {
      setIsCustomMode(false);
    }
  }, [value]);

  const selectValue = (() => {
    if (isCustomMode || value?.type === "custom") return CUSTOM_VALUE;
    if (value?.type === "all-time") return ALL_TIME_VALUE;
    if (value?.type === "preset") return value.value;
    // Nothing picked: the dashboard's default applies, shown as the "Default" item.
    return defaultDateRange ? DEFAULT_VALUE : "";
  })();

  // An editor can make the rolling range they picked the dashboard's default, or remove the default while
  // looking at it. Custom ranges and "all time" are not offered: a default keeps moving with today.
  const canSaveAsDefault =
    onDefaultDateRangeChange !== undefined &&
    value?.type === "preset" &&
    isDashboardDefaultDateRange(value.value) &&
    value.value !== defaultDateRange;
  const canRemoveDefault = onDefaultDateRangeChange !== undefined && defaultDateRange !== null && !value;

  // Custom range only produces a filter once both bounds are chosen; a half-picked range keeps the
  // previous view rather than navigating to an invalid query.
  const emitCustom = (start: Date | null, end: Date | null) => {
    if (start && end) {
      onChange({ type: "custom", range: [formatLocalDay(start), formatLocalDay(end)] });
    }
  };

  const handleSelect = (next: string) => {
    if (next === CUSTOM_VALUE) {
      setIsCustomMode(true);
      emitCustom(customStart, customEnd);
      return;
    }
    setIsCustomMode(false);
    if (next === DEFAULT_VALUE) {
      // Clear the dashboard-level override so every widget falls back to its own saved range.
      onChange(null);
      return;
    }
    if (next === ALL_TIME_VALUE) {
      onChange({ type: "all-time" });
      return;
    }
    onChange({ type: "preset", value: next });
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectValue} onValueChange={handleSelect}>
        <SelectTrigger className="w-48 bg-white">
          <SelectValue placeholder={t("workspace.analysis.dashboards.date_filter_choose")} />
        </SelectTrigger>
        <SelectContent className="max-h-[var(--radix-select-content-available-height)]">
          <SelectItem value={DEFAULT_VALUE}>
            {defaultDateRange
              ? t("workspace.analysis.dashboards.date_filter_dashboard_default", {
                  range: getTranslatedDatePresetLabel(defaultDateRange, t),
                })
              : t("workspace.analysis.dashboards.date_filter_default")}
          </SelectItem>
          <SelectItem value={ALL_TIME_VALUE}>
            {t("workspace.analysis.dashboards.date_filter_all_time")}
          </SelectItem>
          {DATE_RANGE_PRESETS.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {getTranslatedDatePresetLabel(preset, t)}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>{t("workspace.analysis.charts.custom_range")}</SelectItem>
        </SelectContent>
      </Select>

      {selectValue === CUSTOM_VALUE && (
        <DateRangePicker
          value={{ from: customStart ?? undefined, to: customEnd ?? undefined }}
          locale={locale}
          triggerClassName="w-64"
          onChange={({ from, to }) => {
            setCustomStart(from);
            setCustomEnd(to);
            emitCustom(from, to);
          }}
        />
      )}

      {canSaveAsDefault && (
        <TooltipRenderer tooltipContent={t("workspace.analysis.dashboards.set_default_date_range_tooltip")}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isSavingDefault}
            onClick={() => {
              if (value?.type === "preset" && isDashboardDefaultDateRange(value.value)) {
                onDefaultDateRangeChange?.(value.value);
              }
            }}>
            {t("workspace.analysis.dashboards.set_default_date_range")}
          </Button>
        </TooltipRenderer>
      )}
      {canRemoveDefault && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={isSavingDefault}
          onClick={() => onDefaultDateRangeChange?.(null)}>
          {t("workspace.analysis.dashboards.remove_default_date_range")}
        </Button>
      )}
    </div>
  );
};
