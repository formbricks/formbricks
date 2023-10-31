import "server-only";

import { TSurveyDates } from "@formbricks/types/surveys";

export const formatSurveyDateFields = (survey: TSurveyDates): TSurveyDates => {
  if (typeof survey.createdAt === "string") {
    survey.createdAt = new Date(survey.createdAt);
  }
  if (typeof survey.updatedAt === "string") {
    survey.updatedAt = new Date(survey.updatedAt);
  }
  if (typeof survey.closeOnDate === "string") {
    survey.closeOnDate = new Date(survey.closeOnDate);
  }

  return survey;
};
