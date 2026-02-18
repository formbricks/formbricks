"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import Calendar from "react-calendar";
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
import { TimeDimensionConfig } from "@/modules/ee/analysis/lib/query-builder";
import { DATE_PRESETS, FEEDBACK_FIELDS, TIME_GRANULARITIES } from "@/modules/ee/analysis/lib/schema-definition";

interface TimeDimensionPanelProps {
  timeDimension: TimeDimensionConfig | null;
  onTimeDimensionChange: (config: TimeDimensionConfig | null) => void;
}

export function TimeDimensionPanel({ timeDimension, onTimeDimensionChange }: TimeDimensionPanelProps) {
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

  const handleGranularityChange = (granularity: TimeDimensionConfig["granularity"]) => {
    if (timeDimension) {
      onTimeDimensionChange({ ...timeDimension, granularity });
    }
  };

  const handlePresetChange = (preset: string) => {
    setPresetValue(preset);
    if (timeDimension) {
      onTimeDimensionChange({ ...timeDimension, dateRange: preset });
    }
  };

  const handleCustomDateChange = () => {
    if (customStartDate && customEndDate && timeDimension) {
      onTimeDimensionChange({
        ...timeDimension,
        dateRange: [customStartDate, customEndDate],
      });
    }
  };

  if (!timeDimension) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Time Dimension</h3>
        <div>
          <Button type="button" variant="outline" onClick={handleEnableTimeDimension}>
            Enable Time Dimension
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Time Dimension</h3>
        <Button type="button" variant="ghost" size="sm" onClick={handleDisableTimeDimension}>
          Disable
        </Button>
      </div>

      <div className="space-y-3">
        {/* Field Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Field</label>
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
          <label className="text-sm font-medium text-gray-700">Granularity</label>
          <Select
            value={timeDimension.granularity}
            onValueChange={(value) => handleGranularityChange(value as TimeDimensionConfig["granularity"])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
          <label className="text-sm font-medium text-gray-700">Date Range</label>
          <div className="space-y-2">
            <Select
              value={dateRangeType}
              onValueChange={(value) => setDateRangeType(value as "preset" | "custom")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preset">Preset</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {dateRangeType === "preset" ? (
              <Select value={presetValue} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select preset" />
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
                      {customStartDate ? format(customStartDate, "MMM dd, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      onChange={(date: Date) => {
                        setCustomStartDate(date);
                        if (date && customEndDate) {
                          handleCustomDateChange();
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
                      {customEndDate ? format(customEndDate, "MMM dd, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      onChange={(date: Date) => {
                        setCustomEndDate(date);
                        if (customStartDate && date) {
                          handleCustomDateChange();
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
