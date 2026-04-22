import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { recallToHeadline } from "@/lib/utils/recall";
import { TUnifySurvey, TUnifySurveyElement } from "./types";

const getElementHeadline = (element: TSurveyElement, survey: TSurvey): string => {
  return (
    getTextContent(
      getLocalizedValue(recallToHeadline(element.headline, survey, false, "default"), "default")
    ) || "Untitled"
  );
};

const mapSurveyStatus = (status: string): TUnifySurvey["status"] => {
  switch (status) {
    case "inProgress":
      return "active";
    case "paused":
      return "paused";
    case "draft":
      return "draft";
    case "completed":
      return "completed";
    default:
      return "draft";
  }
};

export const transformToUnifySurvey = (survey: TSurvey): TUnifySurvey => {
  const elements = getElementsFromBlocks(survey.blocks);

  const unifySurveyElements: TUnifySurveyElement[] = elements
    .filter((el) => el.type !== TSurveyElementTypeEnum.CTA)
    .map((el) => ({
      id: el.id,
      type: el.type,
      headline: getElementHeadline(el, survey),
      required: el.required ?? false,
    }));

  return {
    id: survey.id,
    name: survey.name,
    status: mapSurveyStatus(survey.status),
    elements: unifySurveyElements,
    createdAt: survey.createdAt,
  };
};
