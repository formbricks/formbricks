import { TAttributes } from "@formbricks/types/attributes";
import { TSurvey } from "@formbricks/types/surveys";

export const getIsDebug = () => window.location.search.includes("formbricksDebug=true");

export const getLanguageCode = (survey: TSurvey, attributes: TAttributes): string | undefined => {
  const language = attributes.language;
  const availableLanguageCodes = survey.languages.map((surveyLanguage) => surveyLanguage.language.code);
  if (!language) return "default";
  else {
    const selectedLanguage = survey.languages.find((surveyLanguage) => {
      return surveyLanguage.language.code === language || surveyLanguage.language.alias === language;
    });
    if (selectedLanguage?.default) {
      return "default";
    }
    if (
      !selectedLanguage ||
      !selectedLanguage?.enabled ||
      !availableLanguageCodes.includes(selectedLanguage.language.code)
    ) {
      return undefined;
    }
    return selectedLanguage.language.code;
  }
};

export const getDefaultLanguageCode = (survey: TSurvey) => {
  const defaultSurveyLanguage = survey.languages?.find((surveyLanguage) => {
    return surveyLanguage.default === true;
  });
  if (defaultSurveyLanguage) return defaultSurveyLanguage.language.code;
};
