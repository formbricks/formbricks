"use client";

import {
  DateRange,
  useResponseFilter,
} from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import ResponseFilter from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResponseFilter";
import { generateQuestionAndFilterOptions, getTodayDate } from "@/app/lib/surveys/surveys";
import { differenceInDays, format, startOfDay, subDays } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useClickOutside } from "@formbricks/lib/utils/hooks/useClickOutside";
import { TSurveyPersonAttributes } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import { Calendar } from "@formbricks/ui/Calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";

enum DateSelected {
  FROM = "from",
  TO = "to",
}

enum FilterDropDownLabels {
  ALL_TIME = "All time",
  LAST_7_DAYS = "Last 7 days",
  LAST_30_DAYS = "Last 30 days",
  CUSTOM_RANGE = "Custom range...",
}

interface CustomFilterProps {
  environmentTags: TTag[];
  attributes: TSurveyPersonAttributes;
  survey: TSurvey;
}

const getDifferenceOfDays = (from, to) => {
  const days = differenceInDays(to, from);
  if (days === 7) {
    return FilterDropDownLabels.LAST_7_DAYS;
  } else if (days === 30) {
    return FilterDropDownLabels.LAST_30_DAYS;
  } else {
    return FilterDropDownLabels.CUSTOM_RANGE;
  }
};

const CustomFilter = ({ environmentTags, attributes, survey }: CustomFilterProps) => {
  const { setSelectedOptions, dateRange, setDateRange } = useResponseFilter();
  const [filterRange, setFilterRange] = useState<FilterDropDownLabels>(
    dateRange.from && dateRange.to
      ? getDifferenceOfDays(dateRange.from, dateRange.to)
      : FilterDropDownLabels.ALL_TIME
  );
  const [selectingDate, setSelectingDate] = useState<DateSelected>(DateSelected.FROM);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [isFilterDropDownOpen, setIsFilterDropDownOpen] = useState<boolean>(false);
  const [hoveredRange, setHoveredRange] = useState<DateRange | null>(null);

  // when the page loads we get total responses and iterate over the responses and questions, tags and attributes to create the filter options
  useEffect(() => {
    const { questionFilterOptions, questionOptions } = generateQuestionAndFilterOptions(
      survey,
      environmentTags,
      attributes
    );
    setSelectedOptions({ questionFilterOptions, questionOptions });
  }, [survey, setSelectedOptions, environmentTags, attributes]);

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

  useClickOutside(datePickerRef, () => handleDatePickerClose());

  return (
    <>
      <div className="relative mb-12 flex justify-between">
        <div className="flex justify-stretch gap-x-1.5">
          <ResponseFilter />
          <DropdownMenu
            onOpenChange={(value) => {
              value && handleDatePickerClose();
              setIsFilterDropDownOpen(value);
            }}>
            <DropdownMenuTrigger>
              <div className="flex h-auto min-w-[8rem] items-center justify-between rounded-md border border-slate-200 bg-white p-3 hover:border-slate-300 sm:min-w-[11rem] sm:px-6 sm:py-3">
                <span className="text-sm text-slate-700">
                  {filterRange === FilterDropDownLabels.CUSTOM_RANGE
                    ? `${dateRange?.from ? format(dateRange?.from, "dd LLL") : "Select first date"} - ${
                        dateRange?.to ? format(dateRange.to, "dd LLL") : "Select last date"
                      }`
                    : filterRange}
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
                className="hover:ring-0"
                onClick={() => {
                  setFilterRange(FilterDropDownLabels.ALL_TIME);
                  setDateRange({ from: undefined, to: getTodayDate() });
                }}>
                <p className="text-slate-700">All time</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  setFilterRange(FilterDropDownLabels.LAST_7_DAYS);
                  setDateRange({ from: startOfDay(subDays(new Date(), 7)), to: getTodayDate() });
                }}>
                <p className="text-slate-700">Last 7 days</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  setFilterRange(FilterDropDownLabels.LAST_30_DAYS);
                  setDateRange({ from: startOfDay(subDays(new Date(), 30)), to: getTodayDate() });
                }}>
                <p className="text-slate-700">Last 30 days</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  setIsDatePickerOpen(true);
                  setFilterRange(FilterDropDownLabels.CUSTOM_RANGE);
                  setSelectingDate(DateSelected.FROM);
                }}>
                <p className="text-sm text-slate-700 hover:ring-0">Custom range...</p>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isDatePickerOpen && (
          <div ref={datePickerRef} className="absolute top-full z-50 my-2 rounded-md border bg-white">
            <Calendar
              initialFocus
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

export default CustomFilter;
