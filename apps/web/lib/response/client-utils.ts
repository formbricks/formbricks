import { TResponseDataValue } from "@formbricks/types/responses";
import {
  TSurveyElement,
  TSurveyMultipleChoiceElement,
  TSurveyPictureSelectionElement,
  TSurveyRankingElement,
} from "@formbricks/types/surveys/elements";

export const extractChoiceIdsFromResponse = (
  responseValue: TResponseDataValue,
  element: TSurveyElement,
  language: string = "default"
): string[] => {
  if (
    element.type !== "multipleChoiceMulti" &&
    element.type !== "multipleChoiceSingle" &&
    element.type !== "ranking" &&
    element.type !== "pictureSelection"
  ) {
    return [];
  }

  const isPictureSelection = element.type === "pictureSelection";

  if (!responseValue) {
    return [];
  }

  if (isPictureSelection) {
    if (Array.isArray(responseValue)) {
      return responseValue.filter((id): id is string => typeof id === "string");
    }
    if (typeof responseValue === "string") {
      return [responseValue];
    }
    return [];
  }

  const defaultLanguage = language ?? "default";

  const findChoiceByLabel = (choiceLabel: string): string | null => {
    const targetChoice = element.choices.find((c) => {
      if (c.label[defaultLanguage] === choiceLabel) {
        return true;
      }
      return Object.values(c.label).includes(choiceLabel);
    });
    return targetChoice?.id || "other";
  };

  if (Array.isArray(responseValue)) {
    return responseValue.map(findChoiceByLabel).filter((choiceId): choiceId is string => choiceId !== null);
  }
  if (typeof responseValue === "string") {
    const choiceId = findChoiceByLabel(responseValue);
    return choiceId ? [choiceId] : [];
  }

  return [];
};

export const getChoiceIdByValue = (
  value: string,
  element: TSurveyMultipleChoiceElement | TSurveyRankingElement | TSurveyPictureSelectionElement
) => {
  if (element.type === "pictureSelection") {
    return element.choices.find((choice) => choice.imageUrl === value)?.id ?? "other";
  }

  return element.choices.find((choice) => choice.label.default === value)?.id ?? "other";
};
