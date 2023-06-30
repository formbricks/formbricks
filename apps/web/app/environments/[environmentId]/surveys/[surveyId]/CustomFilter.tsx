"use client";

import {
  Calender,
  ErrorComponent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui";
import { format, subDays, addDays, isAfter, differenceInDays } from "date-fns";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Button } from "@formbricks/ui";
import {
  CheckCircleIcon,
  PauseCircleIcon,
  PencilSquareIcon,
  PlayCircleIcon,
} from "@heroicons/react/24/solid";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useEnvironment } from "@/lib/environments/environments";
import { generateQuestionsAndAttributes } from "@/lib/surveys/surveys";
import LinkSurveyShareButton from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/LinkModalButton";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { useSurveyMutation } from "@/lib/surveys/mutateSurveys";
import SurveyStatusIndicator from "@/components/shared/SurveyStatusIndicator";
import { getTodaysDateFormatted } from "@formbricks/lib/time";
import { convertToCSV } from "@/lib/csvConversion";
import useClickOutside from "@formbricks/lib/useClickOutside";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { useRouter } from "next/navigation";
import { createId } from "@paralleldrive/cuid2";
import SuccessMessage from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/SuccessMessage";

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

enum FilterDownload {
  ALL = "all",
  FILTER = "filter",
}

enum FilterDropDownLabels {
  LAST_7_DAYS = "Last 7 days",
  LAST_30_DAYS = "Last 30 days",
  CUSTOM_RANGE = "Custom range...",
}

interface CustomFilterProps {
  surveyId: string;
  environmentId: string;
  survey: TSurvey;
  responses: TResponse[];
  totalResponses: TResponse[];
  tab: string;
  from: Date | undefined;
  to: Date | undefined;
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

const CustomFilter = ({
  environmentId,
  responses,
  survey,
  surveyId,
  totalResponses,
  tab,
  from,
  to,
}: CustomFilterProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: from ? from : subDays(new Date(), 7),
    to: to ? to : new Date(),
  });
  const [isDownloadCSVLoading, setIsDownloadCSVLoading] = useState(false);
  const [filterRange, setFilterRange] = useState<FilterDropDownLabels>(
    from && to ? getDifferenceOfDays(from, to) : FilterDropDownLabels.LAST_7_DAYS
  );
  const [dateRangePrev, setDateRangePrev] = useState(dateRange);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [isFilterDropDownOpen, setIsFilterDropDownOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!isDatePickerOpen && dateRange?.from && dateRange?.to) {
      router.push(
        `/environments/${environmentId}/surveys/${surveyId}/${tab}?from=${dateRange?.from}&to=${
          dateRange?.to
        }${searchParams?.get("success") ? `&success=${searchParams?.get("success")}` : ""}`
      );
    }
  }, [dateRange, isDatePickerOpen, router, environmentId, surveyId, tab, searchParams]);

  const datePickerRef = useRef<HTMLDivElement>(null);
  const { environment, isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);
  const { triggerSurveyMutate } = useSurveyMutation(environmentId, surveyId);

  const isLoading = isLoadingEnvironment;

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

  const csvFileName = useMemo(() => {
    if (survey) {
      const formattedDateString = getTodaysDateFormatted("_");
      return `${survey.name.split(" ").join("_")}_responses_${formattedDateString}`.toLocaleLowerCase();
    }

    return "my_survey_responses";
  }, [survey]);

  const downloadResponses = useCallback(
    async (filter: FilterDownload) => {
      const downloadResponse = filter === FilterDownload.ALL ? totalResponses : responses;
      const { attributeMap, questionNames } = generateQuestionsAndAttributes(survey, downloadResponse);
      const matchQandA = getMatchQandA(downloadResponse, survey);
      const csvData = matchQandA.map((response) => {
        const csvResponse = {
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
          csvResponse[questionName] = matchingQuestion ? transformedAnswer : "";
        });

        return csvResponse;
      });

      // Add attribute columns to the CSV

      Object.keys(attributeMap).forEach((attributeName) => {
        const attributeValues = attributeMap[attributeName];
        Object.keys(attributeValues).forEach((personId) => {
          const value = attributeValues[personId];
          const matchingResponse = csvData.find((response) => response["Formbricks User ID"] === personId);
          if (matchingResponse) {
            matchingResponse[attributeName] = value;
          }
        });
      });

      // Fields which will be used as column headers in the CSV
      const fields = [
        "Response ID",
        "Timestamp",
        "Finished",
        "Survey ID",
        "Formbricks User ID",
        ...Object.keys(attributeMap),
        ...questionNames,
      ];

      setIsDownloadCSVLoading(true);

      let response;

      try {
        response = await convertToCSV({
          json: csvData,
          fields,
          fileName: csvFileName,
        });
      } catch (err) {
        toast.error("Error downloading CSV");
        setIsDownloadCSVLoading(false);
        return;
      }

      setIsDownloadCSVLoading(false);

      const blob = new Blob([response.csvResponse], { type: "text/csv;charset=utf-8;" });
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;

      link.download = `${csvFileName}.csv`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(downloadUrl);
    },
    [csvFileName, responses, totalResponses, survey]
  );

  const handleDateChange = (range: DateRange | undefined) => {
    if (!range) {
      // this is the for the case when we select from and to on the same day
      if (dateRange?.from) {
        const endOfRange = new Date(dateRange.from);
        endOfRange.setHours(23, 59, 59, 999);
        setDateRange((prevDate) => ({ from: prevDate.from, to: endOfRange }));
      }
    }
    if (range?.from) {
      const startOfRange = new Date(range.from);
      startOfRange.setHours(0, 0, 0, 0); // Set to the start of the selected day
      setDateRange((prevData) => ({ from: startOfRange, to: prevData?.to }));
    }
    if (range?.to) {
      const endOfRange = new Date(range.to);
      endOfRange.setHours(23, 59, 59, 999); // Set to the end of the selected day
      setDateRange((prevData) => ({ from: prevData?.from, to: endOfRange }));
    }
    if (range?.to !== dateRange?.to) {
      // to close up the modal only when second date is changed
      setIsDatePickerOpen(false);
    }
  };

  const handleDatePickerClose = () => {
    if (dateRangePrev?.to) {
      if (!dateRange?.from) {
        setDateRange((prevValue) => ({ from: dateRangePrev?.from, to: prevValue?.to }));
      }
      if (!dateRange?.to) {
        const toDate = !dateRange?.from
          ? dateRangePrev?.to
          : isAfter(dateRange?.from, dateRangePrev?.to)
          ? addDays(dateRange?.from, 1)
          : dateRangePrev?.to;
        setDateRange((prevValue) => ({ from: prevValue?.from, to: toDate }));
      }
    }
    setIsDatePickerOpen(false);
  };

  useClickOutside(datePickerRef, () => handleDatePickerClose());

  if (isErrorEnvironment) {
    return <ErrorComponent />;
  }

  return (
    <>
      <div className="relative mt-8 flex justify-between">
        <div className="flex justify-stretch gap-x-1.5">
          <DropdownMenu
            onOpenChange={(value) => {
              value && handleDatePickerClose();
              setIsFilterDropDownOpen(value);
            }}>
            <DropdownMenuTrigger disabled={isLoading}>
              <div className="flex h-full min-w-[11rem] items-center justify-between rounded-md border bg-white px-6 py-3">
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
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  setFilterRange(FilterDropDownLabels.LAST_7_DAYS);
                  setDateRange({ from: subDays(new Date(), 7), to: new Date() });
                }}>
                <p className="text-slate-700">Last 7 days</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  setFilterRange(FilterDropDownLabels.LAST_30_DAYS);
                  setDateRange({ from: subDays(new Date(), 30), to: new Date() });
                }}>
                <p className="text-slate-700">Last 30 days</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  setDateRangePrev(dateRange);
                  setIsDatePickerOpen(true);
                  setFilterRange(FilterDropDownLabels.CUSTOM_RANGE);
                }}>
                <p className="text-sm text-slate-700 hover:ring-0">Custom range...</p>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu onOpenChange={(value) => value && handleDatePickerClose()}>
            <DropdownMenuTrigger disabled={isLoading} asChild className="focus:bg-muted outline-none">
              <Button variant="secondary" loading={isDownloadCSVLoading}>
                <ArrowDownTrayIcon width={22} height={22} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  downloadResponses(FilterDownload.ALL);
                }}>
                <p className="text-slate-700">All responses (CSV)</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:ring-0"
                onClick={() => {
                  downloadResponses(FilterDownload.FILTER);
                }}>
                <p className="text-slate-700">Current date range (CSV)</p>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex justify-end gap-x-1.5">
          {survey.type === "link" && <LinkSurveyShareButton survey={survey} />}
          {environment?.widgetSetupCompleted ||
            (survey?.type === "link" && (
              <Select
                onOpenChange={(value) => value && handleDatePickerClose()}
                disabled={isLoading}
                onValueChange={(value) => {
                  triggerSurveyMutate({ status: value })
                    .then(() => {
                      toast.success(
                        value === "inProgress"
                          ? "Survey live"
                          : value === "paused"
                          ? "Survey paused"
                          : value === "completed"
                          ? "Survey completed"
                          : ""
                      );
                      router.refresh();
                    })
                    .catch((error) => {
                      toast.error(`Error: ${error.message}`);
                    });
                }}>
                <SelectTrigger className="w-[170px] bg-white py-6 md:w-[200px]">
                  <SelectValue>
                    <div className="flex items-center">
                      <SurveyStatusIndicator status={survey.status} environmentId={environmentId} />
                      <span className="ml-2 text-sm text-slate-700">
                        {survey.status === "draft" && "Draft"}
                        {survey.status === "inProgress" && "In-progress"}
                        {survey.status === "paused" && "Paused"}
                        {survey.status === "completed" && "Completed"}
                        {survey.status === "archived" && "Archived"}
                      </span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem className="group  font-normal hover:text-slate-900" value="inProgress">
                    <PlayCircleIcon className="-mt-1 mr-1 inline h-5 w-5 text-slate-500 group-hover:text-slate-800" />
                    In-progress
                  </SelectItem>
                  <SelectItem className="group  font-normal hover:text-slate-900" value="paused">
                    <PauseCircleIcon className="-mt-1 mr-1 inline h-5 w-5 text-slate-500 group-hover:text-slate-800" />
                    Paused
                  </SelectItem>
                  <SelectItem className="group  font-normal hover:text-slate-900" value="completed">
                    <CheckCircleIcon className="-mt-1 mr-1 inline h-5 w-5 text-slate-500 group-hover:text-slate-800" />
                    Completed
                  </SelectItem>
                </SelectContent>
              </Select>
            ))}
          <Button
            variant="darkCTA"
            className="h-full w-full px-3 lg:px-6"
            href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
            <PencilSquareIcon className="mr-2 h-5  w-5 text-white" />
            Edit
          </Button>
        </div>
        {isDatePickerOpen && (
          <div ref={datePickerRef} className="absolute top-full z-50 my-2 rounded-md border bg-white">
            <div className="flex items-center justify-center p-1">
              <span
                className="my-1 cursor-pointer text-sm text-blue-500 hover:text-blue-700"
                onClick={() => setDateRange({ from: undefined, to: undefined })}>
                Reset
              </span>
            </div>
            <Calender
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={(range) => handleDateChange(range)}
              numberOfMonths={2}
            />
          </div>
        )}
      </div>
      <hr className="mt-4 h-px border-0 bg-gray-200 dark:bg-gray-700" />
      <SuccessMessage environmentId={environmentId} survey={survey} />
    </>
  );
};

export default CustomFilter;
