import "server-only";

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

  return survey;
};

export const anySurveyHasFilters = (surveys: TSurvey[]) =>
  !surveys.every((survey) => !survey.segment?.filters?.length);
