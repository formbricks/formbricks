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
  getTranslatedDatePresetLabel,
  getTranslatedFieldLabel,
  getTranslatedGranularityLabel,
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

const TIME_FIELD_OPTIONS = FEEDBACK_FIELDS.dimensions.filter((d) => d.type === "time");

interface TimeDimensionPanelProps {
  timeDimension: TimeDimensionConfig | null;
  onTimeDimensionChange: (config: TimeDimensionConfig | null) => void;
  hideTitle?: boolean;
}

export function TimeDimensionPanel({
  timeDimension,
  onTimeDimensionChange,
  hideTitle = false,
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
        {!hideTitle && (
          <h3 className="text-md font-semibold text-gray-900">
            {t("environments.analysis.charts.time_dimension")}
          </h3>
        )}
        <div>
          <Button type="button" variant="outline" onClick={handleEnableTimeDimension}>
            {t("environments.analysis.charts.enable_time_dimension")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {!hideTitle && (
        <h3 className="text-md font-semibold text-gray-900">
          {t("environments.analysis.charts.time_dimension")}
        </h3>
      )}

      <div className="space-y-3">
        {/* Field Selector */}
        <div className="space-y-2">
          <label className="text-sm">{t("environments.analysis.charts.field")}</label>
          <Select value={timeDimension.dimension} onValueChange={handleDimensionChange}>
            <SelectTrigger className="w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_FIELD_OPTIONS.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  {getTranslatedFieldLabel(field.id, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Granularity Selector */}
        <div className="space-y-2">
          <label className="text-sm">{t("environments.analysis.charts.granularity")}</label>
          <Select value={timeDimension.granularity ?? "none"} onValueChange={handleGranularityChange}>
            <SelectTrigger className="w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("environments.analysis.charts.no_grouping")}</SelectItem>
              {TIME_GRANULARITIES.map((gran) => (
                <SelectItem key={gran} value={gran}>
                  {getTranslatedGranularityLabel(gran, t)}
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
              <SelectTrigger className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preset">{t("environments.analysis.charts.preset")}</SelectItem>
                <SelectItem value="custom">{t("environments.analysis.charts.custom_range")}</SelectItem>
              </SelectContent>
            </Select>

            {dateRangeType === "preset" ? (
              <Select value={presetValue} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder={t("environments.analysis.charts.select_preset")} />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {getTranslatedDatePresetLabel(preset.value, t)}
                    </SelectItem>
                  ))}
                  {presetValue && !DATE_PRESETS.some((p) => p.value === presetValue) && (
                    <SelectItem key={presetValue} value={presetValue}>
                      {presetValue}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start bg-white text-left font-normal">
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
                        const end = customEndDate ?? date;
                        if (timeDimension) {
                          onTimeDimensionChange({
                            ...timeDimension,
                            dateRange: [date, end],
                          });
                        }
                        if (!customEndDate) setCustomEndDate(end);
                      }}
                      value={customStartDate || undefined}
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start bg-white text-left font-normal">
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
                        const start = customStartDate ?? date;
                        if (timeDimension) {
                          onTimeDimensionChange({
                            ...timeDimension,
                            dateRange: [start, date],
                          });
                        }
                        if (!customStartDate) setCustomStartDate(start);
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
