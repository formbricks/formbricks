import { capturePostHogEvent } from "@/lib/posthog";

interface SurveyResponsePostHogEventParams {
  organizationId: string;
  surveyId: string;
  surveyType: string;
  environmentId: string;
  responseCount: number;
}

/**
 * Determines whether a PostHog event should be captured for the given response count.
 * Fires on the 1st response, then at milestones: 10, 50, 100, 500, and every 500 thereafter.
 */
export const shouldCapturePostHogResponseEvent = (responseCount: number): boolean => {
  if (responseCount === 1) return true;
  if (responseCount === 10) return true;
  if (responseCount === 50) return true;
  if (responseCount === 100) return true;
  if (responseCount >= 500 && responseCount % 500 === 0) return true;
  return false;
};

export const captureSurveyResponsePostHogEvent = ({
  organizationId,
  surveyId,
  surveyType,
  environmentId,
  responseCount,
}: SurveyResponsePostHogEventParams): void => {
  if (!shouldCapturePostHogResponseEvent(responseCount)) return;

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
