"use client";

import * as Sentry from "@sentry/nextjs";
import { TFunction } from "i18next";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { useOrganization } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import {
  DateRange,
  useResponseFilter,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { getResponsesDownloadUrlAction } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/actions";
import { downloadResponsesFile } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/utils";
import { getFormattedFilters, getTodayDate } from "@/app/lib/surveys/surveys";
import {
  DATE_RANGE_PRESETS,
  type TDateRangePreset,
  getCalendarDayInTimeZone,
  getReportingTimeZone,
  resolveCalendarDayRangeBounds,
  resolveDateRangeLabelPreset,
  resolveDateRangePresetBounds,
} from "@/lib/date-ranges";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
import { getSurveyFileUploadConfigs } from "@/modules/storage/survey-file-upload-elements";
import { DateRangeCalendar } from "@/modules/ui/components/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

// Labels for the relative ranges this filter offers. The list itself, its order and what each preset
// means live in `@/lib/date-ranges`, shared with the chart time dimension and the dashboard filter so
// every surface offers the same windows and the Summary tab and a chart over the same field agree.
// Picking one tags `dateRange` with its preset, so the trigger label survives a remount without
// reverse-matching the bounds — several presets span byte-identical days on period-boundary dates (on
// the 30th of a 30-day month, "last 30 days" and "this month" cover the same days) and can't be told
// apart from `{ from, to }` alone. Order still breaks that tie for a manually picked custom range that
// happens to match a preset's bounds.
//
// Labels are `t()` calls rather than bare key strings on purpose: the translation-key scanner
// (`packages/i18n-utils`) only counts keys it can see inside a literal `t("…")`, and reports the rest
// as unused. Keyed by every preset, so a preset added without a label fails to compile.
const PRESET_LABELS: Record<TDateRangePreset, (t: TFunction) => string> = {
  today: (t) => t("workspace.surveys.summary.today"),
  yesterday: (t) => t("workspace.surveys.summary.yesterday"),
  "last 24 hours": (t) => t("workspace.surveys.summary.last_24_hours"),
  "last 7 days": (t) => t("workspace.surveys.summary.last_7_days"),
  "last 30 days": (t) => t("workspace.surveys.summary.last_30_days"),
  "this month": (t) => t("workspace.surveys.summary.this_month"),
  "last month": (t) => t("workspace.surveys.summary.last_month"),
  "this quarter": (t) => t("workspace.surveys.summary.this_quarter"),
  "last quarter": (t) => t("workspace.surveys.summary.last_quarter"),
  "last 6 months": (t) => t("workspace.surveys.summary.last_6_months"),
  "this year": (t) => t("workspace.surveys.summary.this_year"),
  "last year": (t) => t("workspace.surveys.summary.last_year"),
};

const DAY_MONTH_OPTIONS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

interface CustomFilterProps {
  survey: TSurvey;
}

// The days in this filter are calendar days of the organization's reporting zone, so they are shown in
// that zone too — a viewer west of it would otherwise read "Sep 15" for a range that starts on the 16th.
const formatDay = (date: Date, locale: string | undefined, timeZone: string): string =>
  formatDateForDisplay(date, locale, { ...DAY_MONTH_OPTIONS, timeZone });

const getCustomRangeLabel = (
  dateRange: DateRange,
  locale: string | undefined,
  timeZone: string,
  t: TFunction
): string => {
  const from = dateRange?.from
    ? formatDay(dateRange.from, locale, timeZone)
    : t("workspace.surveys.summary.select_first_date");
  const to = dateRange?.to
    ? formatDay(dateRange.to, locale, timeZone)
    : t("workspace.surveys.summary.select_last_date");

  return `${from} - ${to}`;
};

// The days a preset resolved to, shown next to its name: the window behind the numbers is then visible
// instead of implied, and the Summary tab can be compared with a chart at a glance.
const getResolvedWindowLabel = (
  dateRange: DateRange,
  locale: string | undefined,
  timeZone: string
): string | null => {
  if (!dateRange.from || !dateRange.to) return null;
  const from = formatDay(dateRange.from, locale, timeZone);
  const to = formatDay(dateRange.to, locale, timeZone);
  return from === to ? from : `${from} – ${to}`;
};

const getDateRangeLabel = (dateRange: DateRange, timeZone: string, t: TFunction) => {
  const preset = resolveDateRangeLabelPreset(dateRange, DATE_RANGE_PRESETS, timeZone);
  return preset ? PRESET_LABELS[preset](t) : getFilterDropDownLabels(t).CUSTOM_RANGE;
};

export const CustomFilter = ({ survey }: Readonly<CustomFilterProps>) => {
  const { t, i18n } = useTranslation();
  // `resolvedLanguage` is undefined until i18next finishes initialising, so fall back the way the
  // rest of the app does rather than letting date formatting silently drop to en-US.
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  // Calendar days are cut in the organization's reporting zone, never the browser's, so two colleagues
  // on different continents see one number and the Summary tab agrees with the charts (ENG-3215).
  const { organization } = useOrganization();
  const timeZone = getReportingTimeZone(organization?.displayTimeZone);
  const { selectedFilter, dateRange, setDateRange, resetState } = useResponseFilter();
  const [filterRange, setFilterRange] = useState(
    dateRange.from && dateRange.to
      ? getDateRangeLabel(dateRange, timeZone, t)
      : getFilterDropDownLabels(t).ALL_TIME
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

  // The attachment items only make sense when the survey actually collects files. Hidden rather than
  // disabled: a survey with no file-upload element has nothing to explain.
  const hasFileUploadElements = useMemo(
    () => getSurveyFileUploadConfigs({ blocks: survey.blocks, questions: survey.questions }).length > 0,
    [survey.blocks, survey.questions]
  );

  /**
   * Attachments are downloaded by navigating to the export route, never by fetch + blob: the archive can
   * reach several GB and buffering it in the tab would kill it.
   *
   * That is also why this pre-flights. Once the route has flushed its 200 and headers it can no longer
   * answer with an error, and a problem document rendered into the tab would replace this page. So ask
   * for the counts first, toast anything the user needs to know, and only then navigate.
   */
  const handleDownloadAttachments = async (filter: FilterDownload) => {
    const buildUrl = (extra?: Record<string, string>) => {
      const params = new URLSearchParams(extra);
      if (filter === FilterDownload.FILTER) {
        params.set("filters", JSON.stringify(filters));
      }
      return `/api/surveys/${survey.id}/attachments?${params.toString()}`;
    };

    // Held from the click until either an error or the navigation, because both phases are slow enough
    // to look like nothing happened: the pre-flight counts every matching file, and the download request
    // then collects them again before the first byte reaches the browser.
    const toastId = toast.loading(t("workspace.surveys.responses.preparing_attachments_download"));

    try {
      setIsDownloading(true);

      const preflight = await fetch(buildUrl({ dryRun: "true" }));
      if (!preflight.ok) {
        toast.error(t("workspace.surveys.responses.error_downloading_attachments"), { id: toastId });
        return;
      }

      const { data } = await preflight.json();

      if (data.exceedsMaxFiles) {
        toast.error(
          t("workspace.surveys.responses.too_many_attachments_to_download", { maxFiles: data.maxFiles }),
          { id: toastId }
        );
        return;
      }

      if (data.fileCount === 0) {
        toast.error(t("workspace.surveys.responses.no_attachments_to_download"), { id: toastId });
        return;
      }

      window.location.assign(buildUrl());

      // A `Content-Disposition: attachment` navigation never unloads this page, so the toast survives to
      // hand over to the browser's own download UI. It says "started" rather than "finished" on purpose:
      // nothing here can observe the archive completing.
      toast.success(
        t("workspace.surveys.responses.attachments_download_started", { fileCount: data.fileCount }),
        { id: toastId, duration: 8000 }
      );
    } catch (err) {
      Sentry.captureException(err);
      toast.error(t("workspace.surveys.responses.error_downloading_attachments"), { id: toastId });
    } finally {
      setIsDownloading(false);
    }
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

  const isCustomRange = filterRange === getFilterDropDownLabels(t).CUSTOM_RANGE;
  const resolvedWindowLabel =
    !isCustomRange && dateRange.preset ? getResolvedWindowLabel(dateRange, locale, timeZone) : null;

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
              {isCustomRange ? getCustomRangeLabel(dateRange, locale, timeZone, t) : filterRange}
              {resolvedWindowLabel && <span className="ml-1.5 text-slate-500">{resolvedWindowLabel}</span>}
            </PopoverTriggerButton>
          </DropdownMenuTrigger>
          {/* The shared menu caps itself at 20rem, which hid the tail of this list behind a scrollbar; let
              it take whatever the viewport offers and scroll only when that runs out. */}
          <DropdownMenuContent
            align="start"
            className="max-h-[var(--radix-dropdown-menu-content-available-height)]">
            <DropdownMenuItem
              onClick={() => {
                setFilterRange(getFilterDropDownLabels(t).ALL_TIME);
                setDateRange({ from: undefined, to: getTodayDate() });
              }}>
              <p className="text-slate-700">{getFilterDropDownLabels(t).ALL_TIME}</p>
            </DropdownMenuItem>
            {DATE_RANGE_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset}
                onClick={() => {
                  setFilterRange(PRESET_LABELS[preset](t));
                  setDateRange({ ...resolveDateRangePresetBounds(preset, timeZone), preset });
                }}>
                <p className="text-slate-700">{PRESET_LABELS[preset](t)}</p>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() => {
                setIsDatePickerOpen(true);
                setFilterRange(getFilterDropDownLabels(t).CUSTOM_RANGE);
              }}>
              <p className="text-sm text-slate-700 hover:ring-0">{getFilterDropDownLabels(t).CUSTOM_RANGE}</p>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-slate-500">
              {t("workspace.surveys.summary.date_range_time_zone", { timeZone })}
            </DropdownMenuLabel>
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
            {hasFileUploadElements && (
              <>
                <DropdownMenuItem
                  data-testid="fb__custom-filter-download-all-attachments"
                  onClick={async () => {
                    await handleDownloadAttachments(FilterDownload.ALL);
                  }}>
                  <p className="text-slate-700">{t("workspace.surveys.summary.all_responses_attachments")}</p>
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="fb__custom-filter-download-filtered-attachments"
                  onClick={async () => {
                    await handleDownloadAttachments(FilterDownload.FILTER);
                  }}>
                  <p className="text-slate-700">
                    {t("workspace.surveys.summary.filtered_responses_attachments")}
                  </p>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isDatePickerOpen && (
        <div ref={datePickerRef} className="absolute top-full z-50 my-2 rounded-md border bg-white">
          {/* The calendar speaks calendar days while the filter stores instants, so translate at the
              boundary in the organization's zone: the highlighted days are then the days being queried,
              whatever zone the viewer's browser runs in. */}
          <DateRangeCalendar
            value={{
              from: dateRange.from && getCalendarDayInTimeZone(dateRange.from, timeZone),
              to: dateRange.to && getCalendarDayInTimeZone(dateRange.to, timeZone),
            }}
            locale={locale}
            onChange={(range) => setDateRange(resolveCalendarDayRangeBounds(range, timeZone))}
            onComplete={() => setIsDatePickerOpen(false)}
          />
        </div>
      )}
    </div>
  );
};
