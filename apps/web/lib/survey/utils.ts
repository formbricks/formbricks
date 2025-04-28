import "server-only";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyQuestions } from "@formbricks/types/surveys/types";

export const transformPrismaSurvey = <T extends TSurvey | TJsEnvironmentStateSurvey>(
  surveyPrisma: any
): T => {
  let segment: TSegment | null = null;

  if (surveyPrisma.segment) {
    segment = {
      ...surveyPrisma.segment,
      surveys: surveyPrisma.segment.surveys.map((survey) => survey.id),
    };
  }

  const transformedSurvey = {
    ...surveyPrisma,
    displayPercentage: Number(surveyPrisma.displayPercentage) || null,
    segment,
  } as T;

  return transformedSurvey;
};

export const anySurveyHasFilters = (surveys: TSurvey[]): boolean => {
  return surveys.some((survey) => {
    if ("segment" in survey && survey.segment) {
      return survey.segment.filters && survey.segment.filters.length > 0;
    }
    return false;
  });
};
