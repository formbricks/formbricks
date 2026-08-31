"use client";

import { useState } from "react";
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
import { DateRangePicker } from "@/modules/ui/components/date-picker";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

const TIME_FIELD_OPTIONS = FEEDBACK_FIELDS.dimensions.filter((d) => d.type === "time");

// Sentinel value for the "Custom" entry in the date-range select. Safe against DATE_PRESETS, whose
// values are phrases like "last 30 days" — never this token.
const CUSTOM_RANGE_VALUE = "__custom__";

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
  const { t, i18n } = useTranslation();
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

  // Single date-range select: picking a preset switches to preset mode; picking "Custom" reveals the
  // date pickers (seeded with sensible defaults so the query stays valid immediately).
  const handleDateRangeSelect = (value: string) => {
    if (value !== CUSTOM_RANGE_VALUE) {
      setDateRangeType("preset");
      handlePresetChange(value);
      return;
    }

    setDateRangeType("custom");
    if (!timeDimension) return;
    const start = customStartDate ?? new Date();
    const end = customEndDate ?? start;
    if (!customStartDate) setCustomStartDate(start);
    if (!customEndDate) setCustomEndDate(end);
    onTimeDimensionChange({ ...timeDimension, dateRange: [start, end] });
  };

  if (!timeDimension) {
    return (
      <div className="space-y-2">
        {!hideTitle && (
          <h3 className="text-md font-semibold text-gray-900">
            {t("workspace.analysis.charts.time_dimension")}
          </h3>
        )}
        <div>
          <Button type="button" variant="outline" onClick={handleEnableTimeDimension}>
            {t("workspace.analysis.charts.enable_time_dimension")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {!hideTitle && (
        <h3 className="text-md font-semibold text-gray-900">
          {t("workspace.analysis.charts.time_dimension")}
        </h3>
      )}

      <div className="space-y-3">
        {/* Field Selector */}
        <div className="space-y-3">
          <Label className="text-sm">{t("workspace.analysis.charts.field")}</Label>
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
        <div className="space-y-3">
          <Label className="text-sm">{t("workspace.analysis.charts.granularity")}</Label>
          <Select value={timeDimension.granularity ?? "none"} onValueChange={handleGranularityChange}>
            <SelectTrigger className="w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("workspace.analysis.charts.no_grouping")}</SelectItem>
              {TIME_GRANULARITIES.map((gran) => (
                <SelectItem key={gran} value={gran}>
                  {getTranslatedGranularityLabel(gran, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div className="space-y-3">
          <Label className="text-sm">{t("workspace.analysis.charts.date_range")}</Label>
          <div className="space-y-2">
            <Select
              value={dateRangeType === "custom" ? CUSTOM_RANGE_VALUE : presetValue}
              onValueChange={handleDateRangeSelect}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder={t("workspace.analysis.charts.select_preset")} />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {getTranslatedDatePresetLabel(preset.value, t)}
                  </SelectItem>
                ))}
                {/* preserve a previously-saved preset value we don't recognize */}
                {dateRangeType === "preset" &&
                  presetValue &&
                  !DATE_PRESETS.some((p) => p.value === presetValue) && (
                    <SelectItem key={presetValue} value={presetValue}>
                      {presetValue}
                    </SelectItem>
                  )}
                <SelectItem value={CUSTOM_RANGE_VALUE}>
                  {t("workspace.analysis.charts.custom_range")}
                </SelectItem>
              </SelectContent>
            </Select>

            {dateRangeType === "custom" && (
              <DateRangePicker
                value={{ from: customStartDate ?? undefined, to: customEndDate ?? undefined }}
                locale={i18n.resolvedLanguage}
                triggerClassName="w-full"
                onChange={({ from, to }) => {
                  setCustomStartDate(from);
                  setCustomEndDate(to);
                  if (timeDimension) {
                    onTimeDimensionChange({ ...timeDimension, dateRange: [from, to] });
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
