import { CheckCircle2Icon } from "lucide-react";
import { getLanguageCode, getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { formatDateWithOrdinal } from "@formbricks/lib/utils/datetime";
import { parseRecallInfo } from "@formbricks/lib/utils/recall";
import { TResponse } from "@formbricks/types/responses";
import {
  TSurvey,
  TSurveyMatrixQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyRatingQuestion,
} from "@formbricks/types/surveys/types";
import { AddressResponse } from "../../AddressResponse";
import { FileUploadResponse } from "../../FileUploadResponse";
import { PictureSelectionResponse } from "../../PictureSelectionResponse";
import { RatingResponse } from "../../RatingResponse";
import { isValidValue } from "../util";
import { HiddenFields } from "./HiddenFields";
import { QuestionSkip } from "./QuestionSkip";
import { VerifiedEmail } from "./VerifiedEmail";

interface SingleResponseCardBodyProps {
  survey: TSurvey;
  response: TResponse;
  skippedQuestions: string[][];
}

export const SingleResponseCardBody = ({
  survey,
  response,
  skippedQuestions,
}: SingleResponseCardBodyProps) => {
  const isFirstQuestionAnswered = response.data[survey.questions[0].id] ? true : false;

  const handleArray = (data: string | number | string[]): string => {
    if (Array.isArray(data)) {
      return data.join(", ");
    } else {
      return String(data);
    }
  };

  const formatTextWithSlashes = (text: string) => {
    // Updated regex to match content between #/ and \#
    const regex = /#\/(.*?)\\#/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      // Check if the part was inside #/ and \#
      if (index % 2 === 1) {
        return (
          <span
            key={index}
            className="ml-0.5 mr-0.5 rounded-md border border-slate-200 bg-slate-50 px-1 py-0.5 text-sm first:ml-0">
            @{part}
          </span>
        );
      } else {
        return part;
      }
    });
  };

  const renderResponse = (
    questionType: TSurveyQuestionTypeEnum,
    responseData: string | number | string[] | Record<string, string>,
    question: TSurveyQuestion
  ) => {
    switch (questionType) {
      case TSurveyQuestionTypeEnum.Rating:
        if (typeof responseData === "number")
          return (
            <RatingResponse
              scale={question.scale}
              answer={responseData}
              range={question.range}
              addColors={(question as TSurveyRatingQuestion).isColorCodingEnabled}
            />
          );
      case TSurveyQuestionTypeEnum.Date:
        if (typeof responseData === "string") {
          const formattedDateString = formatDateWithOrdinal(new Date(responseData));
          return <p className="ph-no-capture my-1 font-semibold text-slate-700">{formattedDateString}</p>;
        }
      case TSurveyQuestionTypeEnum.Cal:
        if (typeof responseData === "string")
          return <p className="ph-no-capture my-1 font-semibold capitalize text-slate-700">{responseData}</p>;
      case TSurveyQuestionTypeEnum.PictureSelection:
        if (Array.isArray(responseData))
          return (
            <PictureSelectionResponse
              choices={(question as TSurveyPictureSelectionQuestion).choices}
              selected={responseData}
            />
          );
      case TSurveyQuestionTypeEnum.FileUpload:
        if (Array.isArray(responseData)) return <FileUploadResponse selected={responseData} />;
      case TSurveyQuestionTypeEnum.Matrix:
        if (typeof responseData === "object" && !Array.isArray(responseData)) {
          return (question as TSurveyMatrixQuestion).rows.map((row) => {
            const languagCode = getLanguageCode(survey.languages, response.language);
            const rowValueInSelectedLanguage = getLocalizedValue(row, languagCode);
            if (!responseData[rowValueInSelectedLanguage]) return;
            return (
              <p className="ph-no-capture my-1 font-semibold capitalize text-slate-700">
                {rowValueInSelectedLanguage}: {responseData[rowValueInSelectedLanguage]}
              </p>
            );
          });
        }
      case TSurveyQuestionTypeEnum.Address:
        if (Array.isArray(responseData)) {
          return <AddressResponse value={responseData} />;
        }
      default:
        if (
          typeof responseData === "string" ||
          typeof responseData === "number" ||
          Array.isArray(responseData)
        )
          return (
            <p className="ph-no-capture my-1 whitespace-pre-line font-semibold text-slate-700">
              {Array.isArray(responseData) ? handleArray(responseData) : responseData}
            </p>
          );
    }
  };

  return (
    <div className="p-6">
      {survey.welcomeCard.enabled && (
        <QuestionSkip
          skippedQuestions={[]}
          questions={survey.questions}
          status={"welcomeCard"}
          isFirstQuestionAnswered={isFirstQuestionAnswered}
          responseData={response.data}
        />
      )}
      <div className="space-y-6">
        {survey.isVerifyEmailEnabled && response.data["verifiedEmail"] && (
          <VerifiedEmail responseData={response.data} />
        )}
        {survey.questions.map((question) => {
          const skipped = skippedQuestions.find((skippedQuestionElement) =>
            skippedQuestionElement.includes(question.id)
          );

          // If found, remove it from the list
          if (skipped) {
            skippedQuestions = skippedQuestions.filter((item) => item !== skipped);
          }

          return (
            <div key={`${question.id}`}>
              {isValidValue(response.data[question.id]) ? (
                <div>
                  <p className="text-sm text-slate-500">
                    {formatTextWithSlashes(
                      parseRecallInfo(
                        getLocalizedValue(question.headline, "default"),
                        {},
                        response.data,
                        survey.variables,
                        true
                      )
                    )}
                  </p>
                  <div dir="auto">{renderResponse(question.type, response.data[question.id], question)}</div>
                </div>
              ) : (
                <QuestionSkip
                  skippedQuestions={skipped}
                  questions={survey.questions}
                  responseData={response.data}
                  status={
                    response.finished ||
                    (skippedQuestions.length > 0 &&
                      !skippedQuestions[skippedQuestions.length - 1].includes(question.id))
                      ? "skipped"
                      : "aborted"
                  }
                />
              )}
            </div>
          );
        })}
      </div>
      {survey.hiddenFields.enabled && survey.hiddenFields.fieldIds && (
        <HiddenFields hiddenFields={survey.hiddenFields} responseData={response.data} />
      )}
      {response.finished && (
        <div className="mt-4 flex items-center">
          <CheckCircle2Icon className="h-6 w-6 text-slate-400" />
          <p className="mx-2 rounded-lg bg-slate-100 px-2 text-sm font-medium text-slate-700">Completed</p>
        </div>
      )}
    </div>
  );
};
