import "server-only";

import { TSurvey, TSurveyDates } from "@formbricks/types/surveys";

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

  if (survey.userSegment) {
    if (typeof survey.userSegment.createdAt === "string") {
      survey.userSegment.createdAt = new Date(survey.userSegment.createdAt);
    }

    if (typeof survey.userSegment.updatedAt === "string") {
      survey.userSegment.updatedAt = new Date(survey.userSegment.updatedAt);
    }
  }

  return survey;
};
