import { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Adapts a full management-side `TSurvey` into the minimal
 * `TJsEnvironmentStateSurvey` shape that the SDK widget / shared SDK utilities
 * expect. The segment shape is reshaped, and the stored `customCss` is dropped:
 * on the SDK survey `customCss` means compiled, respondent-facing CSS, while a
 * `TSurvey` carries the stored value with its editable source (ENG-2949). Custom
 * CSS reaches the renderer only through its explicit `customCss` prop.
 */
export const toJsWorkspaceStateSurvey = (survey: TSurvey): TJsWorkspaceStateSurvey => {
  const { customCss: _storedCustomCss, ...rest } = survey;
  return {
    ...rest,
    segment: survey.segment ? { id: survey.segment.id, hasFilters: survey.segment.filters.length > 0 } : null,
  } as unknown as TJsWorkspaceStateSurvey;
};
