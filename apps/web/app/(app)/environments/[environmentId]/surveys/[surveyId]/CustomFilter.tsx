"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Calendar,
} from "@formbricks/ui";
import { format, subDays, differenceInDays } from "date-fns";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { ChevronDown, ChevronUp, DownloadIcon } from "lucide-react";
import {
  generateQuestionsAndAttributes,
  generateQuestionAndFilterOptions,
  getTodayDate,
} from "@/lib/surveys/surveys";
import toast from "react-hot-toast";
import { getTodaysDateFormatted } from "@formbricks/lib/time";
import { fetchFile } from "@/lib/fetchFile";
import useClickOutside from "@formbricks/lib/useClickOutside";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { createId } from "@paralleldrive/cuid2";
import ResponseFilter from "./ResponseFilter";
import { DateRange, useResponseFilter } from "@/app/(app)/environments/[environmentId]/ResponseFilterContext";
import { TTag } from "@formbricks/types/v1/tags";

enum DateSelected {
  FROM = "from",
  TO = "to",
}

enum FilterDownload {
  ALL = "all",
  FILTER = "filter",
}

enum FilterDropDownLabels {
  ALL_TIME = "All time",
  LAST_7_DAYS = "Last 7 days",
  LAST_30_DAYS = "Last 30 days",
  CUSTOM_RANGE = "Custom range...",
}

interface CustomFilterProps {
  environmentTags: TTag[];
  survey: TSurvey;
  responses: TResponse[];
  totalResponses: TResponse[];
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

const CustomFilter = ({ environmentTags, responses, survey, totalResponses }: CustomFilterProps) => {
  const { setSelectedOptions, dateRange, setDateRange } = useResponseFilter();
  const [filterRange, setFilterRange] = useState<FilterDropDownLabels>(
    dateRange.from && dateRange.to
      ? getDifferenceOfDays(dateRange.from, dateRange.to)
      : FilterDropDownLabels.ALL_TIME
  );
  const [selectingDate, setSelectingDate] = useState<DateSelected>(DateSelected.FROM);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [isFilterDropDownOpen, setIsFilterDropDownOpen] = useState<boolean>(false);
  const [isDownloadDropDownOpen, setIsDownloadDropDownOpen] = useState<boolean>(false);
  const [hoveredRange, setHoveredRange] = useState<DateRange | null>(null);

  // when the page loads we get total responses and iterate over the responses and questions, tags and attributes to create the filter options
  useEffect(() => {
    const { questionFilterOptions, questionOptions } = generateQuestionAndFilterOptions(
      survey,
      totalResponses,
      environmentTags
    );
    setSelectedOptions({ questionFilterOptions, questionOptions });
  }, [totalResponses, survey, setSelectedOptions, environmentTags]);

  const datePickerRef = useRef<HTMLDivElement>(null);

  const getMatchQandA = (responses: any, survey: any) => {
    if (survey && responses) {
      // Create a mapping of question IDs to their headlines
      const questionIdToHeadline = {};
      survey.questions.forEach((question) => {
        questionIdToHeadline[question.id] = question.headline;
      });

      // Replace question IDs with question headlines in response data
      const updatedResponses = responses.map((response) => {
        const updatedResponse: Array<{
          id: string;
          question: string;
          answer: string;
          type: string;
          scale?: "number" | "star" | "smiley";
          range?: number;
        }> = []; // Specify the type of updatedData
        // iterate over survey questions and build the updated response
        for (const question of survey.questions) {
          const answer = response.data[question.id];
          if (answer) {
            updatedResponse.push({
              id: createId(),
              question: question.headline,
              type: question.type,
              scale: question.scale,
              range: question.range,
              answer: answer as string,
            });
          }
        }
        return { ...response, responses: updatedResponse };
      });

      const updatedResponsesWithTags = updatedResponses.map((response) => ({
        ...response,
        tags: response.tags?.map((tag) => tag),
      }));

      return updatedResponsesWithTags;
    }
    return [];
  };

  const downloadFileName = useMemo(() => {
    if (survey) {
      const formattedDateString = getTodaysDateFormatted("_");
      return `${survey.name.split(" ").join("_")}_responses_${formattedDateString}`.toLocaleLowerCase();
    }

    return "my_survey_responses";
  }, [survey]);

  const downloadResponses = useCallback(
    async (filter: FilterDownload, filetype: "csv" | "xlsx") => {
      const downloadResponse = filter === FilterDownload.ALL ? totalResponses : responses;
      const { attributeMap, questionNames } = generateQuestionsAndAttributes(survey, downloadResponse);
      const matchQandA = getMatchQandA(downloadResponse, survey);
      const jsonData = matchQandA.map((response) => {
        const fileResponse = {
          "Response ID": response.id,
          Timestamp: response.createdAt,
          Finished: response.finished,
          "Survey ID": response.surveyId,
          "Formbricks User ID": response.person?.id ?? "",
        };

        // Map each question name to its corresponding answer
        questionNames.forEach((questionName: string) => {
          const matchingQuestion = response.responses.find((question) => question.question === questionName);
          let transformedAnswer = "";
          if (matchingQuestion) {
            const answer = matchingQuestion.answer;
            if (Array.isArray(answer)) {
              transformedAnswer = answer.join("; ");
            } else {
              transformedAnswer = answer;
            }
          }
          fileResponse[questionName] = matchingQuestion ? transformedAnswer : "";
        });

        return fileResponse;
      });

      // Add attribute columns to the file
      Object.keys(attributeMap).forEach((attributeName) => {
        const attributeValues = attributeMap[attributeName];
        Object.keys(attributeValues).forEach((personId) => {
          const value = attributeValues[personId];
          const matchingResponse = jsonData.find((response) => response["Formbricks User ID"] === personId);
          if (matchingResponse) {
            matchingResponse[attributeName] = value;
          }
        });
      });

      // Fields which will be used as column headers in the file
      const fields = [
        "Response ID",
        "Timestamp",
        "Finished",
        "Survey ID",
        "Formbricks User ID",
        ...Object.keys(attributeMap),
        ...questionNames,
      ];

      let response;

      try {
        response = await fetchFile(
          {
            json: jsonData,
            fields,
            fileName: downloadFileName,
          },
          filetype
        );
      } catch (err) {
        toast.error(`Error downloading ${filetype === "csv" ? "CSV" : "Excel"}`);
        return;
      }

      let blob: Blob;
      if (filetype === "csv") {
        blob = new Blob([response.fileResponse], { type: "text/csv;charset=utf-8;" });
      } else if (filetype === "xlsx") {
        const binaryString = atob(response["fileResponse"]);
        const byteArray = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          byteArray[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([byteArray], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      } else {
        throw new Error(`Unsupported filetype: ${filetype}`);
      }

      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${downloadFileName}.${filetype}`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(downloadUrl);
    },
    [downloadFileName, responses, totalResponses, survey]
  );

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
              <div className="flex h-auto min-w-[8rem] items-center justify-between rounded-md border bg-white p-3 sm:min-w-[11rem] sm:px-6 sm:py-3">
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
                  setDateRange({ from: subDays(new Date(), 7), to: getTodayDate() });
                }}>
                <p className="text-slate-700">Last 7 days</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  setFilterRange(FilterDropDownLabels.LAST_30_DAYS);
                  setDateRange({ from: subDays(new Date(), 30), to: getTodayDate() });
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
          <DropdownMenu
            onOpenChange={(value) => {
              value && handleDatePickerClose();
              setIsDownloadDropDownOpen(value);
            }}>
            <DropdownMenuTrigger asChild className="focus:bg-muted cursor-pointer outline-none">
              <div className="min-w-auto h-auto rounded-md border bg-white p-3 sm:flex sm:min-w-[11rem] sm:px-6 sm:py-3">
                <div className="hidden w-full items-center justify-between sm:flex">
                  <span className="text-sm text-slate-700">Download</span>
                  {isDownloadDropDownOpen ? (
                    <ChevronUp className="ml-2 h-4 w-4 opacity-50" />
                  ) : (
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  )}
                </div>
                <DownloadIcon className="block h-4 sm:hidden" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  downloadResponses(FilterDownload.ALL, "csv");
                }}>
                <p className="text-slate-700">All responses (CSV)</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  downloadResponses(FilterDownload.ALL, "xlsx");
                }}>
                <p className="text-slate-700">All responses (Excel)</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  downloadResponses(FilterDownload.FILTER, "csv");
                }}>
                <p className="text-slate-700">Current selection (CSV)</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  downloadResponses(FilterDownload.FILTER, "xlsx");
                }}>
                <p className="text-slate-700">Current selection (Excel)</p>
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
