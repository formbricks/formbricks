import "server-only";

import { TLegacySurvey } from "@formbricks/types/LegacySurvey";
import { TPerson } from "@formbricks/types/people";
import { TSurvey } from "@formbricks/types/surveys";

export const formatSurveyDateFields = (survey: TSurvey): TSurvey => {
  if (typeof survey.createdAt === "string") {
    survey.createdAt = new Date(survey.createdAt);
  }
  if (typeof survey.updatedAt === "string") {
    survey.updatedAt = new Date(survey.updatedAt);
  }
  if (typeof survey.closeOnDate === "string") {
    survey.closeOnDate = new Date(survey.closeOnDate);
  }

  if (survey.segment) {
    if (typeof survey.segment.createdAt === "string") {
      survey.segment.createdAt = new Date(survey.segment.createdAt);
    }

    if (typeof survey.segment.updatedAt === "string") {
      survey.segment.updatedAt = new Date(survey.segment.updatedAt);
    }
  }

  if (survey.languages) {
    survey.languages.forEach((surveyLanguage) => {
      if (typeof surveyLanguage.language.createdAt === "string") {
        surveyLanguage.language.createdAt = new Date(surveyLanguage.language.createdAt);
      }
      if (typeof surveyLanguage.language.updatedAt === "string") {
        surveyLanguage.language.updatedAt = new Date(surveyLanguage.language.updatedAt);
      }
    });
  }

  return survey;
};

export const anySurveyHasFilters = (surveys: TSurvey[] | TLegacySurvey[]): boolean => {
  return surveys.some((survey) => {
    if ("segment" in survey && survey.segment) {
      return survey.segment.filters && survey.segment.filters.length > 0;
    }
    return false;
  });
};

export const determineLanguageCode = (person: TPerson, survey: TSurvey) => {
  // Default to 'default' if person.attributes.language is not set or not a string
  if (!person.attributes?.language) return "default";
  const languageCodeOrAlias =
    typeof person.attributes?.language === "string" ? person.attributes.language : "default";

  // Find the matching language in the survey
  const selectedLanguage = survey.languages.find(
    (surveyLanguage) =>
      surveyLanguage.language.code === languageCodeOrAlias ||
      surveyLanguage.language.alias === languageCodeOrAlias
  );
  if (!selectedLanguage) return;

  // Determine and return the language code to use
  return selectedLanguage.default ? "default" : selectedLanguage.language.code;
};
