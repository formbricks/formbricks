import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import type { TWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/types/email-authoring-context";

/**
 * The survey the workflow's trigger is bound to, or null when there is none to author against.
 *
 * The authoring context is resolved server-side from the survey bound at page load. If the user
 * switched the trigger survey in this session, the context is stale for the new survey — so the
 * context survey only counts when its id matches the definition's current trigger `surveyId`.
 * Null also covers the fresh-workflow seed (placeholder survey id) and a deleted survey.
 */
export const resolveBoundTriggerSurvey = (
  authoringContext: TWorkflowEmailAuthoringContext | null,
  definition: TWorkflowDefinition | null
): TSurvey | null => {
  const triggerSurveyId = definition?.trigger?.type === "trigger" ? definition.trigger.config.surveyId : null;
  const survey = authoringContext?.survey ?? null;
  return survey?.id === triggerSurveyId ? survey : null;
};
