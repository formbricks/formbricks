"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import Calendar from "react-calendar";
import { useTranslation } from "react-i18next";
import type { TimeDimensionConfig } from "@/modules/ee/analysis/lib/query-builder";
import {
  DATE_PRESETS,
  FEEDBACK_FIELDS,
  TIME_GRANULARITIES,
} from "@/modules/ee/analysis/lib/schema-definition";
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

interface TimeDimensionPanelProps {
  timeDimension: TimeDimensionConfig | null;
  onTimeDimensionChange: (config: TimeDimensionConfig | null) => void;
}

export function TimeDimensionPanel({
  timeDimension,
  onTimeDimensionChange,
}: Readonly<TimeDimensionPanelProps>) {
  const { t } = useTranslation();
  const [dateRangeType, setDateRangeType] = useState<"preset" | "custom">(
    timeDimension && typeof timeDimension.dateRange === "string" ? "preset" : "custom"
  );
  const [customStartDate, setCustomStartDate] = useState<Date | null>(
    timeDimension && Array.isArray(timeDimension.dateRange) ? timeDimension.dateRange[0] : null
  );
  const [customEndDate, setCustomEndDate] = useState<Date | null>(
    timeDimension && Array.isArray(timeDimension.dateRange) ? timeDimension.dateRange[1] : null
  );
  const [presetValue, setPresetValue] = useState<string>(
    timeDimension && typeof timeDimension.dateRange === "string" ? timeDimension.dateRange : ""
  );

  const timeFieldOptions = FEEDBACK_FIELDS.dimensions.filter((d) => d.type === "time");

  const handleEnableTimeDimension = () => {
    if (!timeDimension) {
      onTimeDimensionChange({
        dimension: "FeedbackRecords.collectedAt",
        granularity: "day",
        dateRange: "last 30 days",
      });
      setPresetValue("last 30 days");
      setDateRangeType("preset");
    }
  };

  const handleDisableTimeDimension = () => {
    onTimeDimensionChange(null);
  };

  const handleDimensionChange = (dimension: string) => {
    if (timeDimension) {
      onTimeDimensionChange({ ...timeDimension, dimension });
    }
  };

  const handleGranularityChange = (value: string) => {
    if (timeDimension) {
      const granularity = value === "none" ? undefined : (value as TimeDimensionConfig["granularity"]);
      onTimeDimensionChange({ ...timeDimension, granularity });
    }
  };

  const handlePresetChange = (preset: string) => {
    setPresetValue(preset);
    if (timeDimension) {
      onTimeDimensionChange({ ...timeDimension, dateRange: preset });
    }
  };

  if (!timeDimension) {
    return (
      <div className="space-y-2">
        <h3 className="text-md font-semibold text-gray-900">
          {t("environments.analysis.charts.time_dimension")}
        </h3>
        <div>
          <Button type="button" variant="outline" onClick={handleEnableTimeDimension}>
            {t("environments.analysis.charts.enable_time_dimension")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-gray-900">
          {t("environments.analysis.charts.time_dimension")}
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={handleDisableTimeDimension}>
          {t("common.disable")}
        </Button>
      </div>

      <div className="space-y-3">
        {/* Field Selector */}
        <div className="space-y-2">
          <label className="text-sm">{t("environments.analysis.charts.field")}</label>
          <Select value={timeDimension.dimension} onValueChange={handleDimensionChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeFieldOptions.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Granularity Selector */}
        <div className="space-y-2">
          <label className="text-sm">{t("environments.analysis.charts.granularity")}</label>
          <Select value={timeDimension.granularity ?? "none"} onValueChange={handleGranularityChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("environments.analysis.charts.no_grouping")}</SelectItem>
              {TIME_GRANULARITIES.map((gran) => (
                <SelectItem key={gran} value={gran}>
                  {gran.charAt(0).toUpperCase() + gran.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <label className="text-sm">{t("environments.analysis.charts.date_range")}</label>
          <div className="space-y-2">
            <Select
              value={dateRangeType}
              onValueChange={(value) => setDateRangeType(value as "preset" | "custom")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preset">{t("environments.analysis.charts.preset")}</SelectItem>
                <SelectItem value="custom">{t("environments.analysis.charts.custom_range")}</SelectItem>
              </SelectContent>
            </Select>

            {dateRangeType === "preset" ? (
              <Select value={presetValue} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("environments.analysis.charts.select_preset")} />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate
                        ? format(customStartDate, "MMM dd, yyyy")
                        : t("environments.analysis.charts.start_date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      onChange={(date: Date) => {
                        setCustomStartDate(date);
                        if (timeDimension && date && customEndDate) {
                          onTimeDimensionChange({
                            ...timeDimension,
                            dateRange: [date, customEndDate],
                          });
                        }
                      }}
                      value={customStartDate || undefined}
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate
                        ? format(customEndDate, "MMM dd, yyyy")
                        : t("environments.analysis.charts.end_date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      onChange={(date: Date) => {
                        setCustomEndDate(date);
                        if (timeDimension && customStartDate && date) {
                          onTimeDimensionChange({
                            ...timeDimension,
                            dateRange: [customStartDate, date],
                          });
                        }
                      }}
                      value={customEndDate || undefined}
                      minDate={customStartDate || undefined}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
