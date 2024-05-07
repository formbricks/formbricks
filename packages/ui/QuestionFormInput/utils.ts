import { createI18nString } from "@formbricks/lib/i18n/utils";
import {
  TI18nString,
  TSurvey,
  TSurveyMatrixQuestion,
  TSurveyMultipleChoiceMultiQuestion,
  TSurveyMultipleChoiceSingleQuestion,
  TSurveyQuestion,
} from "@formbricks/types/surveys";

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
  const choiceQuestion = question as TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceSingleQuestion;
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

export const getCardText = (
  survey: TSurvey,
  id: string,
  isThankYouCard: boolean,
  surveyLanguageCodes: string[]
): TI18nString => {
  const card = isThankYouCard ? survey.thankYouCard : survey.welcomeCard;
  return (card[id as keyof typeof card] as TI18nString) || createI18nString("", surveyLanguageCodes);
};

export const determineImageUploaderVisibility = (questionIdx: number, localSurvey: TSurvey) => {
  switch (questionIdx) {
    case localSurvey.questions.length: // Thank You Card
      return !!localSurvey.thankYouCard.imageUrl || !!localSurvey.thankYouCard.videoUrl;
    case -1: // Welcome Card
      return false;
    default:
      // Regular Survey Question
      const question = localSurvey.questions[questionIdx];
      return (!!question && !!question.imageUrl) || (!!question && !!question.videoUrl);
  }
};

export const getLabelById = (id: string) => {
  switch (id) {
    case "headline":
      return "Question";
    case "subheader":
      return "Description";
    case "placeholder":
      return "Placeholder";
    case "buttonLabel":
      return `"Next" Button Label`;
    case "backButtonLabel":
      return `"Back" Button Label`;
    case "lowerLabel":
      return "Lower Label";
    case "upperLabel":
      return "Upper Label";
    default:
      return "";
  }
};

export const getPlaceHolderById = (id: string) => {
  switch (id) {
    case "headline":
      return "Your question here. Recall information with @";
    case "subheader":
      return "Your description here. Recall information with @";
    default:
      return "";
  }
};
