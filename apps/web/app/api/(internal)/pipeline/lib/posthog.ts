import { capturePostHogEvent } from "@/lib/posthog";

interface SurveyResponsePostHogEventParams {
  organizationId: string;
  workspaceId: string;
  surveyId: string;
  surveyType: string;
  environmentId: string;
  responseCount: number;
}

/**
 * Captures a PostHog event for survey responses at milestones:
 * 1st response, every 10th for the first 100 (10, 20, ..., 100),
 * then every 100th (200, 300, 400, ...).
 */
export const captureSurveyResponsePostHogEvent = ({
  organizationId,
  workspaceId,
  surveyId,
  surveyType,
  environmentId,
  responseCount,
}: SurveyResponsePostHogEventParams): void => {
  const isFirst = responseCount === 1;
  const isEvery10thUnder100 = responseCount <= 100 && responseCount % 10 === 0;
  const isEvery100thAbove100 = responseCount > 100 && responseCount % 100 === 0;

  if (!isFirst && !isEvery10thUnder100 && !isEvery100thAbove100) return;

  capturePostHogEvent(
    organizationId,
    "survey_response_received",
    {
      survey_id: surveyId,
      survey_type: surveyType,
      organization_id: organizationId,
      workspace_id: workspaceId,
      environment_id: environmentId,
      response_count: responseCount,
      is_first_response: responseCount === 1,
      milestone: responseCount === 1 ? "first" : String(responseCount),
    },
    { organizationId, workspaceId }
  );
};
