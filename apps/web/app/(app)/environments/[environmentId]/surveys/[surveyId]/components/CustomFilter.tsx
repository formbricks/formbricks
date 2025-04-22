"use client";

import {
  DateRange,
  useResponseFilter,
} from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getResponsesDownloadUrlAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions";
import { getFormattedFilters, getTodayDate } from "@/app/lib/surveys/surveys";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
import { Calendar } from "@/modules/ui/components/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { TFnType, useTranslate } from "@tolgee/react";
import {
  differenceInDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";
import { ArrowDownToLineIcon, ChevronDown, ChevronUp, DownloadIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ResponseFilter } from "./ResponseFilter";

enum DateSelected {
  FROM = "common.from",
  TO = "common.to",
}

enum FilterDownload {
  ALL = "common.all",
  FILTER = "common.filter",
}

const getFilterDropDownLabels = (t: TFnType) => ({
  ALL_TIME: t("environments.surveys.summary.all_time"),
  LAST_7_DAYS: t("environments.surveys.summary.last_7_days"),
  LAST_30_DAYS: t("environments.surveys.summary.last_30_days"),
  THIS_MONTH: t("environments.surveys.summary.this_month"),
  LAST_MONTH: t("environments.surveys.summary.last_month"),
  LAST_6_MONTHS: t("environments.surveys.summary.last_6_months"),
  THIS_QUARTER: t("environments.surveys.summary.this_quarter"),
  LAST_QUARTER: t("environments.surveys.summary.last_quarter"),
  THIS_YEAR: t("environments.surveys.summary.this_year"),
  LAST_YEAR: t("environments.surveys.summary.last_year"),
  CUSTOM_RANGE: t("environments.surveys.summary.custom_range"),
});

interface CustomFilterProps {
  survey: TSurvey;
}

const getDateRangeLabel = (from: Date, to: Date, t: TFnType) => {
  const dateRanges = [
    {
      label: getFilterDropDownLabels(t).LAST_7_DAYS,
      matches: () => differenceInDays(to, from) === 7,
    },
    {
      label: getFilterDropDownLabels(t).LAST_30_DAYS,
      matches: () => differenceInDays(to, from) === 30,
    },
    {
      label: getFilterDropDownLabels(t).THIS_MONTH,
      matches: () =>
        format(from, "yyyy-MM-dd") === format(startOfMonth(new Date()), "yyyy-MM-dd") &&
        format(to, "yyyy-MM-dd") === format(getTodayDate(), "yyyy-MM-dd"),
    },
    {
      label: getFilterDropDownLabels(t).LAST_MONTH,
      matches: () =>
        format(from, "yyyy-MM-dd") === format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd") &&
        format(to, "yyyy-MM-dd") === format(endOfMonth(subMonths(getTodayDate(), 1)), "yyyy-MM-dd"),
    },
    {
      label: getFilterDropDownLabels(t).LAST_6_MONTHS,
      matches: () =>
        format(from, "yyyy-MM-dd") === format(startOfMonth(subMonths(new Date(), 6)), "yyyy-MM-dd") &&
        format(to, "yyyy-MM-dd") === format(endOfMonth(getTodayDate()), "yyyy-MM-dd"),
    },
    {
      label: getFilterDropDownLabels(t).THIS_QUARTER,
      matches: () =>
        format(from, "yyyy-MM-dd") === format(startOfQuarter(new Date()), "yyyy-MM-dd") &&
        format(to, "yyyy-MM-dd") === format(endOfQuarter(getTodayDate()), "yyyy-MM-dd"),
    },
    {
      label: getFilterDropDownLabels(t).LAST_QUARTER,
      matches: () =>
        format(from, "yyyy-MM-dd") === format(startOfQuarter(subQuarters(new Date(), 1)), "yyyy-MM-dd") &&
        format(to, "yyyy-MM-dd") === format(endOfQuarter(subQuarters(getTodayDate(), 1)), "yyyy-MM-dd"),
    },
    {
      label: getFilterDropDownLabels(t).THIS_YEAR,
      matches: () =>
        format(from, "yyyy-MM-dd") === format(startOfYear(new Date()), "yyyy-MM-dd") &&
        format(to, "yyyy-MM-dd") === format(endOfYear(getTodayDate()), "yyyy-MM-dd"),
    },
    {
      label: getFilterDropDownLabels(t).LAST_YEAR,
      matches: () =>
        format(from, "yyyy-MM-dd") === format(startOfYear(subYears(new Date(), 1)), "yyyy-MM-dd") &&
        format(to, "yyyy-MM-dd") === format(endOfYear(subYears(getTodayDate(), 1)), "yyyy-MM-dd"),
    },
  ];

  const matchedRange = dateRanges.find((range) => range.matches());
  return matchedRange ? matchedRange.label : getFilterDropDownLabels(t).CUSTOM_RANGE;
};

export const CustomFilter = ({ survey }: CustomFilterProps) => {
  const params = useParams();
  const isSharingPage = !!params.sharingKey;
  const { t } = useTranslate();
  const { selectedFilter, dateRange, setDateRange, resetState } = useResponseFilter();
  const [filterRange, setFilterRange] = useState(
    dateRange.from && dateRange.to
      ? getDateRangeLabel(dateRange.from, dateRange.to, t)
      : getFilterDropDownLabels(t).ALL_TIME
  );
  const [selectingDate, setSelectingDate] = useState<DateSelected>(DateSelected.FROM);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [isFilterDropDownOpen, setIsFilterDropDownOpen] = useState<boolean>(false);
  const [hoveredRange, setHoveredRange] = useState<DateRange | null>(null);

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

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFilter, dateRange]
  );

  const datePickerRef = useRef<HTMLDivElement>(null);

  const extracMetadataKeys = useCallback((obj, parentKey = "") => {
    let keys: string[] = [];

    for (let key in obj) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        keys = keys.concat(extracMetadataKeys(obj[key], parentKey + key + " - "));
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

  const handleDowndloadResponses = async (filter: FilterDownload, filetype: "csv" | "xlsx") => {
    try {
      const responseFilters = filter === FilterDownload.ALL ? {} : filters;
      const responsesDownloadUrlResponse = await getResponsesDownloadUrlAction({
        surveyId: survey.id,
        format: filetype,
        filterCriteria: responseFilters,
      });
      if (responsesDownloadUrlResponse?.data) {
        const link = document.createElement("a");
        link.href = responsesDownloadUrlResponse.data;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const errorMessage = getFormattedErrorMessage(responsesDownloadUrlResponse);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error("Error downloading responses");
    }
  };

  useClickOutside(datePickerRef, () => handleDatePickerClose());
  return (
    <>
      <div className="relative flex justify-between">
        <div className="flex justify-stretch gap-x-1.5">
          <ResponseFilter survey={survey} />
          <DropdownMenu
            onOpenChange={(value) => {
              value && handleDatePickerClose();
              setIsFilterDropDownOpen(value);
            }}>
            <DropdownMenuTrigger>
              <div className="flex min-w-[8rem] items-center justify-between rounded-md border border-slate-200 bg-white p-3 hover:border-slate-300 sm:min-w-[11rem] sm:px-6 sm:py-3">
                <span className="text-sm text-slate-700">
                  {filterRange === getFilterDropDownLabels(t).CUSTOM_RANGE
                    ? `${dateRange?.from ? format(dateRange?.from, "dd LLL") : "Select first date"} - ${
                        dateRange?.to ? format(dateRange.to, "dd LLL") : "Select last date"
                      }`
                    : t(filterRange)}
                </span>
                {isFilterDropDownOpen ? (
                  <ChevronUp className="ml-2 h-4 w-4 opacity-50" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  setFilterRange(getFilterDropDownLabels(t).ALL_TIME);
                  setDateRange({ from: undefined, to: getTodayDate() });
                }}>
                <p className="text-slate-700">{t(getFilterDropDownLabels(t).ALL_TIME)}</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilterRange(getFilterDropDownLabels(t).LAST_7_DAYS);
                  setDateRange({ from: startOfDay(subDays(new Date(), 7)), to: getTodayDate() });
                }}>
                <p className="text-slate-700">{t(getFilterDropDownLabels(t).LAST_7_DAYS)}</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilterRange(getFilterDropDownLabels(t).LAST_30_DAYS);
                  setDateRange({ from: startOfDay(subDays(new Date(), 30)), to: getTodayDate() });
                }}>
                <p className="text-slate-700">{t(getFilterDropDownLabels(t).LAST_30_DAYS)}</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilterRange(getFilterDropDownLabels(t).THIS_MONTH);
                  setDateRange({ from: startOfMonth(new Date()), to: getTodayDate() });
                }}>
                <p className="text-slate-700">{t(getFilterDropDownLabels(t).THIS_MONTH)}</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilterRange(getFilterDropDownLabels(t).LAST_MONTH);
                  setDateRange({
                    from: startOfMonth(subMonths(new Date(), 1)),
                    to: endOfMonth(subMonths(getTodayDate(), 1)),
                  });
                }}>
                <p className="text-slate-700">{t(getFilterDropDownLabels(t).LAST_MONTH)}</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilterRange(getFilterDropDownLabels(t).THIS_QUARTER);
                  setDateRange({ from: startOfQuarter(new Date()), to: endOfQuarter(getTodayDate()) });
                }}>
                <p className="text-slate-700">{t(getFilterDropDownLabels(t).THIS_QUARTER)}</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilterRange(getFilterDropDownLabels(t).LAST_QUARTER);
                  setDateRange({
                    from: startOfQuarter(subQuarters(new Date(), 1)),
                    to: endOfQuarter(subQuarters(getTodayDate(), 1)),
                  });
                }}>
                <p className="text-slate-700">{t(getFilterDropDownLabels(t).LAST_QUARTER)}</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilterRange(getFilterDropDownLabels(t).LAST_6_MONTHS);
                  setDateRange({
                    from: startOfMonth(subMonths(new Date(), 6)),
                    to: endOfMonth(getTodayDate()),
                  });
                }}>
                <p className="text-slate-700">{t(getFilterDropDownLabels(t).LAST_6_MONTHS)}</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilterRange(getFilterDropDownLabels(t).THIS_YEAR);
                  setDateRange({ from: startOfYear(new Date()), to: endOfYear(getTodayDate()) });
                }}>
                <p className="text-slate-700">{t(getFilterDropDownLabels(t).THIS_YEAR)}</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilterRange(getFilterDropDownLabels(t).LAST_YEAR);
                  setDateRange({
                    from: startOfYear(subYears(new Date(), 1)),
                    to: endOfYear(subYears(getTodayDate(), 1)),
                  });
                }}>
                <p className="text-slate-700">{t(getFilterDropDownLabels(t).LAST_YEAR)}</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setIsDatePickerOpen(true);
                  setFilterRange(getFilterDropDownLabels(t).CUSTOM_RANGE);
                  setSelectingDate(DateSelected.FROM);
                }}>
                <p className="text-sm text-slate-700 hover:ring-0">
                  {t(getFilterDropDownLabels(t).CUSTOM_RANGE)}
                </p>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {!isSharingPage && (
            <DropdownMenu
              onOpenChange={(value) => {
                value && handleDatePickerClose();
              }}>
              <DropdownMenuTrigger asChild className="focus:bg-muted cursor-pointer outline-hidden">
                <div className="h-auto min-w-auto rounded-md border border-slate-200 bg-white p-3 hover:border-slate-300 sm:flex sm:px-6 sm:py-3">
                  <div className="hidden w-full items-center justify-between sm:flex">
                    <span className="text-sm text-slate-700">{t("common.download")}</span>
                    <ArrowDownToLineIcon className="ml-2 h-4 w-4" />
                  </div>
                  <DownloadIcon className="block h-4 sm:hidden" />
                </div>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => {
                    handleDowndloadResponses(FilterDownload.ALL, "csv");
                  }}>
                  <p className="text-slate-700">{t("environments.surveys.summary.all_responses_csv")}</p>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    handleDowndloadResponses(FilterDownload.ALL, "xlsx");
                  }}>
                  <p className="text-slate-700">{t("environments.surveys.summary.all_responses_excel")}</p>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    handleDowndloadResponses(FilterDownload.FILTER, "csv");
                  }}>
                  <p className="text-slate-700">{t("environments.surveys.summary.filtered_responses_csv")}</p>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    handleDowndloadResponses(FilterDownload.FILTER, "xlsx");
                  }}>
                  <p className="text-slate-700">
                    {t("environments.surveys.summary.filtered_responses_excel")}
                  </p>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {isDatePickerOpen && (
          <div ref={datePickerRef} className="absolute top-full z-50 my-2 rounded-md border bg-white">
            <Calendar
              autoFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={hoveredRange ? hoveredRange : dateRange}
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
    </>
  );
};
