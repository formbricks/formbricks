import { TFunction } from "i18next";
import { type TI18nString } from "@formbricks/types/i18n";
import {
  TSurveyElement,
  TSurveyMatrixElement,
  TSurveyMultipleChoiceElement,
} from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { createI18nString } from "@/lib/i18n/utils";
import { isLabelValidForAllLanguages } from "@/lib/i18n/utils";

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
  question: TSurveyElement,
  choiceIdx: number,
  surveyLanguageCodes: string[]
): TI18nString => {
  const choiceQuestion = question as TSurveyMultipleChoiceElement;
  return choiceQuestion.choices[choiceIdx]?.label || createI18nString("", surveyLanguageCodes);
};

export const getMatrixLabel = (
  question: TSurveyElement,
  idx: number,
  surveyLanguageCodes: string[],
  type: "row" | "column"
): TI18nString => {
  const matrixQuestion = question as TSurveyMatrixElement;
  const matrixFields = type === "row" ? matrixQuestion.rows : matrixQuestion.columns;
  return matrixFields[idx]?.label || createI18nString("", surveyLanguageCodes);
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
  questions: TSurveyElement[],
  id: string,
  surveyLanguageCodes: string[],
  questionIdx: number
): TI18nString => {
  const endingCardIndex = questionIdx - questions.length;
  const card = survey.endings[endingCardIndex];

  if (card?.type === "endScreen") {
    return (card[id as keyof typeof card] as TI18nString) || createI18nString("", surveyLanguageCodes);
  } else {
    return createI18nString("", surveyLanguageCodes);
  }
};

export const determineImageUploaderVisibility = (questionIdx: number, questions: TSurveyElement[]) => {
  switch (questionIdx) {
    case -1: // Welcome Card
      return false;
    default: {
      // Regular Survey Question - derive questions from blocks
      const question = questions[questionIdx];
      return (!!question && !!question.imageUrl) || (!!question && !!question.videoUrl);
    }
  }
};

export const getPlaceHolderById = (id: string, t: TFunction) => {
  switch (id) {
    case "headline":
      return t("environments.surveys.edit.your_question_here_recall_information_with");
    case "subheader":
      return t("environments.surveys.edit.your_description_here_recall_information_with");
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
    "row",
    "column",
    "choice",
    "label",
    "headline",
    "subheader",
    "lowerLabel",
    "upperLabel",
    "buttonLabel",
    "placeholder",
    "backButtonLabel",
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
