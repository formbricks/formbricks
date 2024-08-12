import "server-only";
import { TI18nString, TSurvey } from "@formbricks/types/surveys/types";
import { structuredClone } from "../pollyfills/structuredClone";
import { getLocalizedValue, isI18nObject } from "./utils";

// Helper function to extract a regular string from an i18nString.
const extractStringFromI18n = (i18nString: TI18nString, languageCode: string): string => {
  if (typeof i18nString === "object" && i18nString !== null) {
    return i18nString[languageCode] || "";
  }
  return i18nString;
};

// Assuming I18nString and extraction logic are defined
const reverseTranslateObject = <T extends Record<string, any>>(obj: T, languageCode: string): T => {
  const clonedObj = structuredClone(obj);
  for (let key in clonedObj) {
    const value = clonedObj[key];
    if (isI18nObject(value)) {
      // Now TypeScript knows `value` is I18nString, treat it accordingly
      clonedObj[key] = extractStringFromI18n(value, languageCode) as T[Extract<keyof T, string>];
    } else if (typeof value === "object" && value !== null) {
      // Recursively handle nested objects
      clonedObj[key] = reverseTranslateObject(value, languageCode);
    }
  }
  return clonedObj;
};

const reverseTranslateEndings = (survey: TSurvey, languageCode: string): any => {
  const firstEndingCard = survey.endings[0];
  if (firstEndingCard && firstEndingCard.type === "endScreen") {
    return {
      headline: getLocalizedValue(firstEndingCard.headline, languageCode),
      subheader: getLocalizedValue(firstEndingCard.subheader, languageCode),
      buttonLabel: getLocalizedValue(firstEndingCard.buttonLabel, languageCode),
      buttonLink: firstEndingCard.buttonLink,
      enabled: true,
    };
  } else {
    return { enabled: false };
  }
};

export const reverseTranslateSurvey = (survey: TSurvey, languageCode: string = "default"): any => {
  const reversedSurvey = structuredClone(survey);
  reversedSurvey.questions = reversedSurvey.questions.map((question) =>
    reverseTranslateObject(question, languageCode)
  );

  // check if the headline is an empty object, if so, add a "default" key
  // TODO: This is a temporary fix, should be handled propperly
  if (reversedSurvey.welcomeCard.headline && Object.keys(reversedSurvey.welcomeCard.headline).length === 0) {
    reversedSurvey.welcomeCard.headline = { default: "" };
  }

  reversedSurvey.welcomeCard = reverseTranslateObject(reversedSurvey.welcomeCard, languageCode);
  // @ts-expect-error
  reversedSurvey.thankYouCard = reverseTranslateEndings(reversedSurvey, languageCode);
  const firstEndingCard = survey.endings[0];
  // @ts-expect-error
  reversedSurvey.redirectUrl = null;
  if (firstEndingCard?.type === "redirectToUrl") {
    // @ts-expect-error
    reversedSurvey.redirectUrl = firstEnabledEnding.url;
  }
  // @ts-expect-error
  reversedSurvey.endings = undefined;
  return reversedSurvey;
};
