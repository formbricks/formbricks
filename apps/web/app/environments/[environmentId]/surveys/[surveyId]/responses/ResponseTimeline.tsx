"use client";

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useResponses } from "@/lib/responses/responses";
import { generateQuestionsAndAttributes, useSurvey } from "@/lib/surveys/surveys";
import { Button, ErrorComponent } from "@formbricks/ui";
import { useMemo } from "react";
import SingleResponse from "./SingleResponse";
import { convertToCSV } from "@/lib/csvConversion";
import { useCallback } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { getTodaysDateFormatted } from "@formbricks/lib/time";

export default function ResponseTimeline({ environmentId, surveyId }) {
  const { responsesData, isLoadingResponses, isErrorResponses } = useResponses(environmentId, surveyId);
  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);

  const responses = responsesData?.responses;

  const { attributeMap, questionNames } = generateQuestionsAndAttributes(survey, responses);

  const [isDownloadCSVLoading, setIsDownloadCSVLoading] = useState(false);

  const matchQandA = useMemo(() => {
    if (survey && responses) {
      // Create a mapping of question IDs to their headlines
      const questionIdToHeadline = {};
      survey.questions.forEach((question) => {
        questionIdToHeadline[question.id] = question.headline;
      });

      // Replace question IDs with question headlines in response data
      const updatedResponses = responses.map((response) => {
        const updatedResponse: Array<{
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
              question: question.headline,
              type: question.type,
              scale: question.scale,
              range: question.range,
              answer: answer as string,
            });
          }
        }
        return { ...response, responses: updatedResponse, person: response.person };
      });
      return updatedResponses;
    }
    return [];
  }, [survey, responses]);

  const csvFileName = useMemo(() => {
    if (survey) {
      const formattedDateString = getTodaysDateFormatted("_");
      return `${survey.name.split(" ").join("_")}_responses_${formattedDateString}`.toLocaleLowerCase();
    }

    return "my_survey_responses";
  }, [survey]);

  const downloadResponses = useCallback(async () => {
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
  }, [attributeMap, csvFileName, matchQandA, questionNames]);

  if (isLoadingResponses || isLoadingSurvey) {
    return <LoadingSpinner />;
  }

  if (isErrorResponses || isErrorSurvey) {
    return <ErrorComponent />;
  }

  return (
    <div className="space-y-4">
      {responses.length === 0 ? (
        <EmptySpaceFiller type="response" environmentId={environmentId} />
      ) : (
        <div>
          <Button variant="darkCTA" onClick={() => downloadResponses()} loading={isDownloadCSVLoading}>
            <div className="flex items-center gap-2">
              <ArrowDownTrayIcon width={16} height={16} />
              <span className="text-sm">Export to CSV</span>
            </div>
          </Button>
          {matchQandA.map((updatedResponse) => {
            return (
              <SingleResponse
                key={updatedResponse.id}
                data={updatedResponse}
                surveyId={surveyId}
                environmentId={environmentId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
