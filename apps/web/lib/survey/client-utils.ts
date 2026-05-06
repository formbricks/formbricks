import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Adapts a full management-side `TSurvey` into the minimal
 * `TJsEnvironmentStateSurvey` shape that the SDK widget / shared SDK utilities
 * expect. Only the segment shape needs reshaping — the rest of `TSurvey` is a
 * structural superset of the SDK survey type.
 */
export const toJsEnvironmentStateSurvey = (survey: TSurvey): TJsEnvironmentStateSurvey => {
  return {
    ...survey,
    segment: survey.segment ? { id: survey.segment.id, hasFilters: survey.segment.filters.length > 0 } : null,
  } as unknown as TJsEnvironmentStateSurvey;
};
