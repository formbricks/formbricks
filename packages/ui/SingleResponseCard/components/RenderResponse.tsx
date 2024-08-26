import React from "react";
import { getLanguageCode, getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { processResponseData } from "@formbricks/lib/responses";
import { formatDateWithOrdinal } from "@formbricks/lib/utils/datetime";
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
import { ResponseBadges } from "../../ResponseBadges";

interface RenderResponseProps {
  responseData: string | number | string[] | Record<string, string>;
  question: TSurveyQuestion;
  survey: TSurvey;
  language: string | null;
  isExpanded?: boolean;
}

export const RenderResponse: React.FC<RenderResponseProps> = ({
  responseData,
  question,
  survey,
  language,
  isExpanded = true,
}) => {
  const handleArray = (data: string | number | string[]): string => {
    if (Array.isArray(data)) {
      return data.join(", ");
    } else {
      return String(data);
    }
  };
  console.log(question);
  console.log(responseData);
  const questionType = question.type;
  switch (questionType) {
    case TSurveyQuestionTypeEnum.Rating:
      if (typeof responseData === "number") {
        return (
          <RatingResponse
            scale={question.scale}
            answer={responseData}
            range={question.range}
            addColors={(question as TSurveyRatingQuestion).isColorCodingEnabled}
          />
        );
      }
      break;
    case TSurveyQuestionTypeEnum.Date:
      if (typeof responseData === "string") {
        const formattedDateString = formatDateWithOrdinal(new Date(responseData));
        return <p className="ph-no-capture my-1 font-semibold text-slate-700">{formattedDateString}</p>;
      }
      break;
    case TSurveyQuestionTypeEnum.Cal:
      if (typeof responseData === "string") {
        return <p className="ph-no-capture my-1 font-semibold capitalize text-slate-700">{responseData}</p>;
      }
      break;
    case TSurveyQuestionTypeEnum.PictureSelection:
      if (Array.isArray(responseData)) {
        return (
          <PictureSelectionResponse
            choices={(question as TSurveyPictureSelectionQuestion).choices}
            selected={responseData}
            isExpanded={isExpanded}
          />
        );
      }
      break;
    case TSurveyQuestionTypeEnum.FileUpload:
      if (Array.isArray(responseData)) {
        return <FileUploadResponse selected={responseData} />;
      }
      break;
    case TSurveyQuestionTypeEnum.Matrix:
      if (typeof responseData === "object" && !Array.isArray(responseData)) {
        return (
          <>
            {(question as TSurveyMatrixQuestion).rows.map((row) => {
              const languagCode = getLanguageCode(survey.languages, language);
              const rowValueInSelectedLanguage = getLocalizedValue(row, languagCode);
              if (!responseData[rowValueInSelectedLanguage]) return null;
              return (
                <p
                  key={rowValueInSelectedLanguage}
                  className="ph-no-capture my-1 font-semibold capitalize text-slate-700">
                  {rowValueInSelectedLanguage}:{processResponseData(responseData[rowValueInSelectedLanguage])}
                </p>
              );
            })}
          </>
        );
      }
      break;
    case TSurveyQuestionTypeEnum.Address:
      if (Array.isArray(responseData)) {
        return <AddressResponse value={responseData} />;
      }
      break;
    case TSurveyQuestionTypeEnum.CTA:
    case TSurveyQuestionTypeEnum.MultipleChoiceMulti:
    case TSurveyQuestionTypeEnum.MultipleChoiceSingle:
    case TSurveyQuestionTypeEnum.NPS:
    case TSurveyQuestionTypeEnum.Consent:
      if (typeof responseData === "string" || typeof responseData === "number") {
        return <ResponseBadges items={[responseData.toString()]} isExpanded={true} />;
      } else if (Array.isArray(responseData)) {
        return <ResponseBadges items={responseData} isExpanded={true} />;
      }
      break;
    default:
      if (
        typeof responseData === "string" ||
        typeof responseData === "number" ||
        Array.isArray(responseData)
      ) {
        return (
          <p className="ph-no-capture my-1 whitespace-pre-line font-semibold text-slate-700">
            {Array.isArray(responseData) ? handleArray(responseData) : responseData}
          </p>
        );
      }
  }

  return null; // Return null if no case is matched
};
