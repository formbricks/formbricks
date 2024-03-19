import { createI18nString } from "@formbricks/lib/i18n/utils";
import {
  TI18nString,
  TSurvey,
  TSurveyMultipleChoiceMultiQuestion,
  TSurveyMultipleChoiceSingleQuestion,
  TSurveyQuestion,
} from "@formbricks/types/surveys";

export const getChoiceIndex = (id: string, isChoice: boolean) => {
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

export const getCardText = (
  survey: TSurvey,
  id: string,
  isThankYouCard: boolean,
  surveyLanguageCodes: string[]
): TI18nString => {
  const card = isThankYouCard ? survey.thankYouCard : survey.welcomeCard;
  return (card[id as keyof typeof card] as TI18nString) || createI18nString("", surveyLanguageCodes);
};

export const determineImageUploaderVisibility = (questionId: string, localSurvey: TSurvey) => {
  switch (questionId) {
    case "end": // Thank You Card
      return !!localSurvey.thankYouCard.imageUrl;
    case "start": // Welcome Card
      return !!localSurvey.welcomeCard.fileUrl;
    default:
      // Regular Survey Question
      const question = localSurvey.questions.find((q) => q.id === questionId);
      return !!question && !!question.imageUrl;
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
