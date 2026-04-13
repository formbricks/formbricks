import { capturePostHogEvent } from "@/lib/posthog";

interface SurveyResponsePostHogEventParams {
  organizationId: string;
  surveyId: string;
  surveyType: string;
  environmentId: string;
  responseCount: number;
}

/**
 * Captures a PostHog event for survey responses at milestones:
 * 1st response, then every 100th (100, 200, 300, ...).
 */
export const captureSurveyResponsePostHogEvent = ({
  organizationId,
  surveyId,
  surveyType,
  environmentId,
  responseCount,
}: SurveyResponsePostHogEventParams): void => {
  if (responseCount !== 1 && responseCount % 100 !== 0) return;

  capturePostHogEvent(organizationId, "survey_response_received", {
    survey_id: surveyId,
    survey_type: surveyType,
    organization_id: organizationId,
    environment_id: environmentId,
    response_count: responseCount,
    is_first_response: responseCount === 1,
    milestone: responseCount === 1 ? "first" : String(responseCount),
  });
};
