"use client";

import * as Sentry from "@sentry/nextjs";
import { format } from "date-fns";
import { TFunction } from "i18next";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  DateRange,
  useResponseFilter,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { getResponsesDownloadUrlAction } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/actions";
import { downloadResponsesFile } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/utils";
import { getFormattedFilters, getTodayDate } from "@/app/lib/surveys/surveys";
import { type TDateRangePreset, matchDateRangePreset, resolveDateRangePresetBounds } from "@/lib/date-ranges";
import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
import { Calendar } from "@/modules/ui/components/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { PopoverTriggerButton, ResponseFilter } from "./ResponseFilter";

enum DateSelected {
  FROM = "common.from",
  TO = "common.to",
}

enum FilterDownload {
  ALL = "common.all",
  FILTER = "common.filter",
}

const getFilterDropDownLabels = (t: TFunction) => ({
  ALL_TIME: t("workspace.surveys.summary.all_time"),
  CUSTOM_RANGE: t("workspace.surveys.summary.custom_range"),
});

// The relative ranges this filter offers, in dropdown order. Order also breaks genuine ties when a
// stored range is mapped back to its label — on the 30th of a 30-day month, "last 30 days" and "this
// month" cover the same days. What each preset means lives in `@/lib/date-ranges`, shared with the
// chart time dimension so the Summary tab and a chart over the same field agree.
const DATE_RANGE_PRESETS: readonly { preset: TDateRangePreset; labelKey: string }[] = [
  { preset: "last 7 days", labelKey: "workspace.surveys.summary.last_7_days" },
  { preset: "last 30 days", labelKey: "workspace.surveys.summary.last_30_days" },
  { preset: "this month", labelKey: "workspace.surveys.summary.this_month" },
  { preset: "last month", labelKey: "workspace.surveys.summary.last_month" },
  { preset: "this quarter", labelKey: "workspace.surveys.summary.this_quarter" },
  { preset: "last quarter", labelKey: "workspace.surveys.summary.last_quarter" },
  { preset: "last 6 months", labelKey: "workspace.surveys.summary.last_6_months" },
  { preset: "this year", labelKey: "workspace.surveys.summary.this_year" },
  { preset: "last year", labelKey: "workspace.surveys.summary.last_year" },
];

const DATE_RANGE_PRESET_NAMES = DATE_RANGE_PRESETS.map(({ preset }) => preset);

interface CustomFilterProps {
  survey: TSurvey;
}

const getDateRangeLabel = (from: Date, to: Date, t: TFunction) => {
  const matchedPreset = matchDateRangePreset(from, to, DATE_RANGE_PRESET_NAMES);
  const labelKey = DATE_RANGE_PRESETS.find(({ preset }) => preset === matchedPreset)?.labelKey;
  return labelKey ? t(labelKey) : getFilterDropDownLabels(t).CUSTOM_RANGE;
};

export const CustomFilter = ({ survey }: CustomFilterProps) => {
  const { t } = useTranslation();
  const { selectedFilter, dateRange, setDateRange, resetState } = useResponseFilter();
  const [filterRange, setFilterRange] = useState(
    dateRange.from && dateRange.to
      ? getDateRangeLabel(dateRange.from, dateRange.to, t)
      : getFilterDropDownLabels(t).ALL_TIME
  );
  const [selectingDate, setSelectingDate] = useState<DateSelected>(DateSelected.FROM);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [isFilterDropDownOpen, setIsFilterDropDownOpen] = useState<boolean>(false);
  const [isDownloadDropDownOpen, setIsDownloadDropDownOpen] = useState<boolean>(false);
  const [hoveredRange, setHoveredRange] = useState<DateRange | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const firstMountRef = useRef(true);

  useEffect(() => {
    if (!firstMountRef.current) {
      firstMountRef.current = false;
      return;
    }
  }, []);

  useEffect(() => {
    if (!firstMountRef.current) {
      resetState();
    }
  }, [survey?.id, resetState]);

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),

    [selectedFilter, dateRange]
  );

  const datePickerRef = useRef<HTMLDivElement>(null);

  const extractMetadataKeys = useCallback((obj: Record<string, unknown>, parentKey = "") => {
    let keys: string[] = [];

    for (let key in obj) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        keys = keys.concat(extractMetadataKeys(obj[key] as Record<string, unknown>, parentKey + key + " - "));
      } else {
        keys.push(parentKey + key);
      }
    }

    return keys;
  }, []);

  const handleDateHoveredChange = (date: Date) => {
    if (selectingDate === DateSelected.FROM) {
      const startOfRange = new Date(date);
      startOfRange.setHours(0, 0, 0, 0); // Set to the start of the selected day

      // Check if the selected date is after the current 'to' date
      if (startOfRange > dateRange?.to!) {
        return;
      } else {
        setHoveredRange({ from: startOfRange, to: dateRange.to });
      }
    } else {
      const endOfRange = new Date(date);
      endOfRange.setHours(23, 59, 59, 999); // Set to the end of the selected day

      // Check if the selected date is before the current 'from' date
      if (endOfRange < dateRange?.from!) {
        return;
      } else {
        setHoveredRange({ from: dateRange.from, to: endOfRange });
      }
    }
  };

  const handleDateChange = (date: Date) => {
    if (selectingDate === DateSelected.FROM) {
      const startOfRange = new Date(date);
      startOfRange.setHours(0, 0, 0, 0); // Set to the start of the selected day

      // Check if the selected date is after the current 'to' date
      if (startOfRange > dateRange?.to!) {
        const nextDay = new Date(startOfRange);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(23, 59, 59, 999);
        setDateRange({ from: startOfRange, to: nextDay });
      } else {
        setDateRange((prevData) => ({ from: startOfRange, to: prevData.to }));
      }
      setSelectingDate(DateSelected.TO);
    } else {
      const endOfRange = new Date(date);
      endOfRange.setHours(23, 59, 59, 999); // Set to the end of the selected day

      // Check if the selected date is before the current 'from' date
      if (endOfRange < dateRange?.from!) {
        const previousDay = new Date(endOfRange);
        previousDay.setDate(previousDay.getDate() - 1);
        previousDay.setHours(0, 0, 0, 0); // Set to the start of the selected day
        setDateRange({ from: previousDay, to: endOfRange });
      } else {
        setDateRange((prevData) => ({ from: prevData?.from, to: endOfRange }));
      }
      setIsDatePickerOpen(false);
      setSelectingDate(DateSelected.FROM);
    }
  };

  const handleDatePickerClose = () => {
    setIsDatePickerOpen(false);
    setSelectingDate(DateSelected.FROM);
  };

  const handleDownloadResponses = async (filter: FilterDownload, fileType: "csv" | "xlsx") => {
    try {
      const responseFilters = filter === FilterDownload.ALL ? {} : filters;
      setIsDownloading(true);

      const responsesDownloadUrlResponse = await getResponsesDownloadUrlAction({
        surveyId: survey.id,
        format: fileType,
        filterCriteria: responseFilters,
      });

      if (responsesDownloadUrlResponse?.data) {
        downloadResponsesFile(
          responsesDownloadUrlResponse.data.fileName,
          responsesDownloadUrlResponse.data.fileContents,
          fileType
        );
      } else {
        toast.error(t("workspace.surveys.responses.error_downloading_responses"));
      }
    } catch (err) {
      Sentry.captureException(err);
      toast.error(t("workspace.surveys.responses.error_downloading_responses"));
    } finally {
      setIsDownloading(false);
    }
  };

  useClickOutside(datePickerRef, () => handleDatePickerClose());
  return (
    <div className="relative flex justify-between">
      <div className="flex justify-stretch gap-x-1.5">
        <ResponseFilter survey={survey} />
        <DropdownMenu
          onOpenChange={(value) => {
            value && handleDatePickerClose();
            setIsFilterDropDownOpen(value);
          }}>
          <DropdownMenuTrigger asChild>
            <PopoverTriggerButton isOpen={isFilterDropDownOpen}>
              {filterRange === getFilterDropDownLabels(t).CUSTOM_RANGE
                ? `${dateRange?.from ? format(dateRange?.from, "dd LLL") : "Select first date"} - ${
                    dateRange?.to ? format(dateRange.to, "dd LLL") : "Select last date"
                  }`
                : filterRange}
            </PopoverTriggerButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                setFilterRange(getFilterDropDownLabels(t).ALL_TIME);
                setDateRange({ from: undefined, to: getTodayDate() });
              }}>
              <p className="text-slate-700">{getFilterDropDownLabels(t).ALL_TIME}</p>
            </DropdownMenuItem>
            {DATE_RANGE_PRESETS.map(({ preset, labelKey }) => (
              <DropdownMenuItem
                key={preset}
                onClick={() => {
                  setFilterRange(t(labelKey));
                  setDateRange(resolveDateRangePresetBounds(preset));
                }}>
                <p className="text-slate-700">{t(labelKey)}</p>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() => {
                setIsDatePickerOpen(true);
                setFilterRange(getFilterDropDownLabels(t).CUSTOM_RANGE);
                setSelectingDate(DateSelected.FROM);
              }}>
              <p className="text-sm text-slate-700 hover:ring-0">{getFilterDropDownLabels(t).CUSTOM_RANGE}</p>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu
          onOpenChange={(value) => {
            value && handleDatePickerClose();
            setIsDownloadDropDownOpen(value);
          }}>
          <DropdownMenuTrigger asChild>
            <PopoverTriggerButton isOpen={isDownloadDropDownOpen} disabled={isDownloading}>
              <span className="flex items-center gap-2">
                {t("common.download")}
                {isDownloading && <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />}
              </span>
            </PopoverTriggerButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start">
            <DropdownMenuItem
              data-testid="fb__custom-filter-download-all-csv"
              onClick={async () => {
                await handleDownloadResponses(FilterDownload.ALL, "csv");
              }}>
              <p className="text-slate-700">{t("workspace.surveys.summary.all_responses_csv")}</p>
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="fb__custom-filter-download-all-xlsx"
              onClick={async () => {
                await handleDownloadResponses(FilterDownload.ALL, "xlsx");
              }}>
              <p className="text-slate-700">{t("workspace.surveys.summary.all_responses_excel")}</p>
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="fb__custom-filter-download-filtered-csv"
              onClick={async () => {
                await handleDownloadResponses(FilterDownload.FILTER, "csv");
              }}>
              <p className="text-slate-700">{t("workspace.surveys.summary.filtered_responses_csv")}</p>
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="fb__custom-filter-download-filtered-xlsx"
              onClick={async () => {
                await handleDownloadResponses(FilterDownload.FILTER, "xlsx");
              }}>
              <p className="text-slate-700">{t("workspace.surveys.summary.filtered_responses_excel")}</p>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isDatePickerOpen && (
        <div ref={datePickerRef} className="absolute top-full z-50 my-2 rounded-md border bg-white">
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={hoveredRange || dateRange}
            numberOfMonths={2}
            onDayClick={(date) => handleDateChange(date)}
            onDayMouseEnter={handleDateHoveredChange}
            onDayMouseLeave={() => setHoveredRange(null)}
            classNames={{
              day_today: "hover:bg-slate-200 bg-white",
            }}
          />
        </div>
      )}
    </div>
  );
};
