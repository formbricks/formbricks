"use client";

import * as Sentry from "@sentry/nextjs";
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
import {
  type TDateRangePreset,
  resolveDateRangeLabelPreset,
  resolveDateRangePresetBounds,
} from "@/lib/date-ranges";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
import { DateRangeCalendar } from "@/modules/ui/components/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { PopoverTriggerButton, ResponseFilter } from "./ResponseFilter";

enum FilterDownload {
  ALL = "common.all",
  FILTER = "common.filter",
}

const getFilterDropDownLabels = (t: TFunction) => ({
  ALL_TIME: t("workspace.surveys.summary.all_time"),
  CUSTOM_RANGE: t("workspace.surveys.summary.custom_range"),
});

// The relative ranges this filter offers, in dropdown order. Picking one tags `dateRange` with its
// preset, so the trigger label survives a remount without reverse-matching the bounds — several
// presets span byte-identical days on period-boundary dates (on the 30th of a 30-day month, "last 30
// days" and "this month" cover the same days) and can't be told apart from `{ from, to }` alone. Order
// still breaks that tie for a manually picked custom range that happens to match a preset's bounds.
// What each preset means lives in `@/lib/date-ranges`, shared with the chart time dimension so the
// Summary tab and a chart over the same field agree.
//
// Labels are `t()` calls rather than bare key strings on purpose: the translation-key scanner
// (`packages/i18n-utils`) only counts keys it can see inside a literal `t("…")`, and reports the rest
// as unused.
const DATE_RANGE_PRESETS: readonly { preset: TDateRangePreset; getLabel: (t: TFunction) => string }[] = [
  { preset: "last 7 days", getLabel: (t) => t("workspace.surveys.summary.last_7_days") },
  { preset: "last 30 days", getLabel: (t) => t("workspace.surveys.summary.last_30_days") },
  { preset: "this month", getLabel: (t) => t("workspace.surveys.summary.this_month") },
  { preset: "last month", getLabel: (t) => t("workspace.surveys.summary.last_month") },
  { preset: "this quarter", getLabel: (t) => t("workspace.surveys.summary.this_quarter") },
  { preset: "last quarter", getLabel: (t) => t("workspace.surveys.summary.last_quarter") },
  { preset: "last 6 months", getLabel: (t) => t("workspace.surveys.summary.last_6_months") },
  { preset: "this year", getLabel: (t) => t("workspace.surveys.summary.this_year") },
  { preset: "last year", getLabel: (t) => t("workspace.surveys.summary.last_year") },
];

const DATE_RANGE_PRESET_NAMES = DATE_RANGE_PRESETS.map(({ preset }) => preset);

const DAY_MONTH_OPTIONS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

interface CustomFilterProps {
  survey: TSurvey;
}

const getCustomRangeLabel = (dateRange: DateRange, locale: string | undefined, t: TFunction): string => {
  const from = dateRange?.from
    ? formatDateForDisplay(dateRange.from, locale, DAY_MONTH_OPTIONS)
    : t("workspace.surveys.summary.select_first_date");
  const to = dateRange?.to
    ? formatDateForDisplay(dateRange.to, locale, DAY_MONTH_OPTIONS)
    : t("workspace.surveys.summary.select_last_date");

  return `${from} - ${to}`;
};

const getDateRangeLabel = (dateRange: DateRange, t: TFunction) => {
  const preset = resolveDateRangeLabelPreset(dateRange, DATE_RANGE_PRESET_NAMES);
  const matched = DATE_RANGE_PRESETS.find((p) => p.preset === preset);
  return matched ? matched.getLabel(t) : getFilterDropDownLabels(t).CUSTOM_RANGE;
};

export const CustomFilter = ({ survey }: Readonly<CustomFilterProps>) => {
  const { t, i18n } = useTranslation();
  // `resolvedLanguage` is undefined until i18next finishes initialising, so fall back the way the
  // rest of the app does rather than letting date formatting silently drop to en-US.
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const { selectedFilter, dateRange, setDateRange, resetState } = useResponseFilter();
  const [filterRange, setFilterRange] = useState(
    dateRange.from && dateRange.to ? getDateRangeLabel(dateRange, t) : getFilterDropDownLabels(t).ALL_TIME
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [isFilterDropDownOpen, setIsFilterDropDownOpen] = useState<boolean>(false);
  const [isDownloadDropDownOpen, setIsDownloadDropDownOpen] = useState<boolean>(false);
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

    [survey, selectedFilter, dateRange]
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

  const handleDatePickerClose = () => {
    setIsDatePickerOpen(false);
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
                ? getCustomRangeLabel(dateRange, locale, t)
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
            {DATE_RANGE_PRESETS.map(({ preset, getLabel }) => (
              <DropdownMenuItem
                key={preset}
                onClick={() => {
                  setFilterRange(getLabel(t));
                  setDateRange({ ...resolveDateRangePresetBounds(preset), preset });
                }}>
                <p className="text-slate-700">{getLabel(t)}</p>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() => {
                setIsDatePickerOpen(true);
                setFilterRange(getFilterDropDownLabels(t).CUSTOM_RANGE);
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
          <DateRangeCalendar
            value={dateRange}
            locale={locale}
            onChange={setDateRange}
            onComplete={() => setIsDatePickerOpen(false)}
          />
        </div>
      )}
    </div>
  );
};
