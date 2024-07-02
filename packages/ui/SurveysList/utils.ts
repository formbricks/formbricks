import { TSurveyFilterCriteria, TSurveyFilters } from "@formbricks/types/surveys/types";

export const getFormattedFilters = (surveyFilters: TSurveyFilters, userId: string): TSurveyFilterCriteria => {
  const filters: TSurveyFilterCriteria = {};

  if (surveyFilters.name) {
    filters.name = surveyFilters.name;
  }

  if (surveyFilters.status && surveyFilters.status.length) {
    filters.status = surveyFilters.status;
  }

  if (surveyFilters.type && surveyFilters.type.length) {
    filters.type = surveyFilters.type;
  }

  if (surveyFilters.createdBy && surveyFilters.createdBy.length) {
    filters.createdBy = {
      userId: userId,
      value: surveyFilters.createdBy,
    };
  }

  if (surveyFilters.sortBy) {
    filters.sortBy = surveyFilters.sortBy;
  }

  return filters;
};
