"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DASHBOARD_DATE_PRESETS } from "@/modules/ee/analysis/lib/date-presets";
import { getTranslatedDatePresetLabel } from "@/modules/ee/analysis/lib/schema-definition";
import { DateRangePicker } from "@/modules/ui/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import {
  ALL_TIME_VALUE,
  CUSTOM_VALUE,
  DEFAULT_VALUE,
  type TDashboardDateFilter,
} from "../lib/dashboard-date-filter";

interface DashboardDateFilterProps {
  value: TDashboardDateFilter | null;
  onChange: (filter: TDashboardDateFilter | null) => void;
}

// Custom-range bounds serialize with the local `format(date, "yyyy-MM-dd")` below, so they must be
// parsed back as local calendar days too. `new Date("YYYY-MM-DD")` parses as UTC midnight, which
// shows (and re-emits) a day earlier for anyone west of UTC — parse the parts as local instead to
// keep the round trip symmetric.
const parseLocalDate = (iso: string): Date => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const DashboardDateFilter = ({ value, onChange }: Readonly<DashboardDateFilterProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  const [isCustomMode, setIsCustomMode] = useState(value?.type === "custom");
  const [customStart, setCustomStart] = useState<Date | null>(
    value?.type === "custom" ? parseLocalDate(value.range[0]) : null
  );
  const [customEnd, setCustomEnd] = useState<Date | null>(
    value?.type === "custom" ? parseLocalDate(value.range[1]) : null
  );

  // Query-only navigation (back/forward, or restoring a persisted filter) keeps this component
  // mounted, so re-sync the local custom-range state whenever the incoming value changes to keep
  // the UI aligned with the URL rather than showing stale bounds.
  useEffect(() => {
    if (value?.type === "custom") {
      setIsCustomMode(true);
      setCustomStart(parseLocalDate(value.range[0]));
      setCustomEnd(parseLocalDate(value.range[1]));
    } else {
      setIsCustomMode(false);
    }
  }, [value]);

  const selectValue = (() => {
    if (isCustomMode || value?.type === "custom") return CUSTOM_VALUE;
    if (value?.type === "all-time") return ALL_TIME_VALUE;
    if (value?.type === "preset") return value.value;
    return "";
  })();

  // Custom range only produces a filter once both bounds are chosen; a half-picked range keeps the
  // previous view rather than navigating to an invalid query.
  const emitCustom = (start: Date | null, end: Date | null) => {
    if (start && end) {
      onChange({ type: "custom", range: [format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")] });
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
          <SelectValue placeholder={t("workspace.analysis.dashboards.date_filter_placeholder")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_VALUE}>
            {t("workspace.analysis.dashboards.date_filter_default")}
          </SelectItem>
          <SelectItem value={ALL_TIME_VALUE}>
            {t("workspace.analysis.dashboards.date_filter_all_time")}
          </SelectItem>
          {DASHBOARD_DATE_PRESETS.map((preset) => (
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
    </div>
  );
};
