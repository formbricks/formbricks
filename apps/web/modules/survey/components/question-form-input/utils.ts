import { TFnType } from "@tolgee/react";
import { createI18nString } from "@formbricks/lib/i18n/utils";
import { isLabelValidForAllLanguages } from "@formbricks/lib/i18n/utils";
import {
  TI18nString,
  TSurvey,
  TSurveyMatrixQuestion,
  TSurveyMultipleChoiceQuestion,
  TSurveyQuestion,
} from "@formbricks/types/surveys/types";

// Function to get index for choice /rowLabel /columnLabel
export const getIndex = (id: string, isChoice: boolean) => {
  if (!isChoice) return null;

  const parts = id.split("-");
  if (parts.length > 1) {
    return parseInt(parts[1], 10);
  }
  return null;
};

export const getChoiceLabel = (
  question: TSurveyQuestion,
  choiceIdx: number,
  surveyLanguageCodes: string[]
): TI18nString => {
  const choiceQuestion = question as TSurveyMultipleChoiceQuestion;
  return choiceQuestion.choices[choiceIdx]?.label || createI18nString("", surveyLanguageCodes);
};

export const getMatrixLabel = (
  question: TSurveyQuestion,
  idx: number,
  surveyLanguageCodes: string[],
  type: "row" | "column"
): TI18nString => {
  const matrixQuestion = question as TSurveyMatrixQuestion;
  const labels = type === "row" ? matrixQuestion.rows : matrixQuestion.columns;
  return labels[idx] || createI18nString("", surveyLanguageCodes);
};

export const getWelcomeCardText = (
  survey: TSurvey,
  id: string,
  surveyLanguageCodes: string[]
): TI18nString => {
  const card = survey.welcomeCard;
  return (card[id as keyof typeof card] as TI18nString) || createI18nString("", surveyLanguageCodes);
};

export const getEndingCardText = (
  survey: TSurvey,
  id: string,
  surveyLanguageCodes: string[],
  questionIdx: number
): TI18nString => {
  const endingCardIndex = questionIdx - survey.questions.length;
  const card = survey.endings[endingCardIndex];
  if (card.type === "endScreen") {
    return (card[id as keyof typeof card] as TI18nString) || createI18nString("", surveyLanguageCodes);
  } else {
    return createI18nString("", surveyLanguageCodes);
  }
};

export const determineImageUploaderVisibility = (questionIdx: number, localSurvey: TSurvey) => {
  switch (questionIdx) {
    case -1: // Welcome Card
      return false;
    default:
      // Regular Survey Question
      const question = localSurvey.questions[questionIdx];
      return (!!question && !!question.imageUrl) || (!!question && !!question.videoUrl);
  }
};

export const getPlaceHolderById = (id: string, t: TFnType) => {
  switch (id) {
    case "headline":
      return t("environments.surveys.edit.your_question_here_recall_information_with");
    case "subheader":
      return t("environments.surveys.edit.your_description_here_recall_information_with");
    case "tooltip":
      return t("environments.surveys.edit.your_tooltip_here_recall_information_with");
    default:
      return "";
  }
};

export const isValueIncomplete = (
  id: string,
  isInvalid: boolean,
  surveyLanguageCodes: string[],
  value?: TI18nString
) => {
  // Define a list of IDs for which a default value needs to be checked.
  const labelIds = [
    "label",
    "headline",
    "subheader",
    "lowerLabel",
    "upperLabel",
    "buttonLabel",
    "placeholder",
    "backButtonLabel",
    "dismissButtonLabel",
  ];

  // If value is not provided, immediately return false as it cannot be incomplete.
  if (value === undefined) return false;

  // Check if the default value is incomplete. This applies only to specific label IDs.
  // For these IDs, the default value should not be an empty string.
  const isDefaultIncomplete = labelIds.includes(id) ? value["default"]?.trim() !== "" : false;

  // Return true if all the following conditions are met:
  // 1. The field is marked as invalid.
  // 2. The label is not valid for all provided language codes in the survey.
  // 4. For specific label IDs, the default value is incomplete as defined above.
  return isInvalid && !isLabelValidForAllLanguages(value, surveyLanguageCodes) && isDefaultIncomplete;
};
