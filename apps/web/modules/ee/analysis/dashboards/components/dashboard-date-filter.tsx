"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import Calendar from "react-calendar";
import { useTranslation } from "react-i18next";
import { DASHBOARD_DATE_PRESETS } from "@/modules/ee/analysis/lib/date-presets";
import { getTranslatedDatePresetLabel } from "@/modules/ee/analysis/lib/schema-definition";
import { Button } from "@/modules/ui/components/button";
import "@/modules/ui/components/date-picker/styles.css";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { ALL_TIME_VALUE, CUSTOM_VALUE, type TDashboardDateFilter } from "../lib/dashboard-date-filter";

interface DashboardDateFilterProps {
  value: TDashboardDateFilter | null;
  onChange: (filter: TDashboardDateFilter | null) => void;
}

export const DashboardDateFilter = ({ value, onChange }: Readonly<DashboardDateFilterProps>) => {
  const { t } = useTranslation();

  const [isCustomMode, setIsCustomMode] = useState(value?.type === "custom");
  const [customStart, setCustomStart] = useState<Date | null>(
    value?.type === "custom" ? new Date(value.range[0]) : null
  );
  const [customEnd, setCustomEnd] = useState<Date | null>(
    value?.type === "custom" ? new Date(value.range[1]) : null
  );

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
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start bg-white text-left font-normal">
                <CalendarIcon className="mr-2 size-4" />
                {customStart
                  ? format(customStart, "MMM dd, yyyy")
                  : t("workspace.analysis.charts.start_date")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                onChange={(v) => {
                  const date = v instanceof Date ? v : new Date();
                  setCustomStart(date);
                  emitCustom(date, customEnd);
                }}
                value={customStart || undefined}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start bg-white text-left font-normal">
                <CalendarIcon className="mr-2 size-4" />
                {customEnd ? format(customEnd, "MMM dd, yyyy") : t("workspace.analysis.charts.end_date")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                onChange={(v) => {
                  const date = v instanceof Date ? v : new Date();
                  setCustomEnd(date);
                  emitCustom(customStart, date);
                }}
                value={customEnd || undefined}
                minDate={customStart || undefined}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
};
