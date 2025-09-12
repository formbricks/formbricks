import { TSurveyLanguage } from "@formbricks/types/surveys/types";

export const getI18nLanguage = (languageCode: string, languages: TSurveyLanguage[]) => {
  let locale = languageCode;

  const isDefaultLanguage = languageCode === "default";
  if (isDefaultLanguage) {
    locale = languages.find((lng) => lng.default)?.language?.code || "en";
  }

  return locale;
};
