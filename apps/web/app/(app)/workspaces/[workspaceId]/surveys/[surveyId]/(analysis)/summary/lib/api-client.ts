import type { TSurveyEmailEmbedResource } from "@/app/api/internal/surveys/[surveyId]/email-embed/serializers";
import type { TSurveyExampleResponsesResource } from "@/app/api/internal/surveys/[surveyId]/example-responses/serializers";
import type { TSurveyPersonalLinksResource } from "@/app/api/internal/surveys/[surveyId]/personal-links/serializers";
import type { TSurveyResetResource } from "@/app/api/internal/surveys/[surveyId]/resets/serializers";
import type { TSurveySingleUseSettingsResource } from "@/app/api/internal/surveys/[surveyId]/single-use-settings/serializers";
import { getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * The survey summary's and its share modal's calls to `/api/internal/surveys/{surveyId}/…`. Each throws a
 * `V3ApiError` on a refusal, with the server's reason (an archived survey, an AI gate's error code, a
 * personal-link error code) as its message where there is one.
 */

const surveyPath = (surveyId: string, resource: string) =>
  `/api/internal/surveys/${encodeURIComponent(surveyId)}/${resource}`;

/** The survey rendered as an email body, for the Email tab's preview and embed code. */
export const getSurveyEmailEmbed = (surveyId: string, signal?: AbortSignal) =>
  getApiData<TSurveyEmailEmbedResource>(surveyPath(surveyId, "email-embed"), { signal });

/** Email the signed-in user the survey's email embed. Sends an email, so it waits as long as it takes. */
export const sendSurveyPreviewEmail = (surveyId: string) =>
  sendApiRequest<{ emailSent: boolean }>(surveyPath(surveyId, "preview-emails"), {
    method: "POST",
    timeoutMs: null,
  });

/** Delete every response and display of the survey. */
export const resetSurvey = (surveyId: string) =>
  sendApiRequest<TSurveyResetResource>(surveyPath(surveyId, "resets"), { method: "POST" });

/** Write AI-generated example responses into a survey with none. LLM calls: it can run for minutes. */
export const generateExampleResponses = (surveyId: string) =>
  sendApiRequest<TSurveyExampleResponsesResource>(surveyPath(surveyId, "example-responses"), {
    method: "POST",
    timeoutMs: null,
  });

/** A CSV of personal links for a segment's contacts; a large segment takes a while. */
export const generatePersonalLinks = ({
  surveyId,
  ...body
}: {
  surveyId: string;
  segmentId: string;
  expirationDays?: number;
}) =>
  sendApiRequest<TSurveyPersonalLinksResource>(surveyPath(surveyId, "personal-links"), {
    method: "POST",
    body,
    timeoutMs: null,
  });

/** Switch the survey's link between multi-use and single-use, and its single-use ids' encryption. */
export const saveSingleUseSettings = ({
  surveyId,
  ...body
}: {
  surveyId: string;
  enabled: boolean;
  isEncrypted: boolean;
}) =>
  sendApiRequest<TSurveySingleUseSettingsResource>(surveyPath(surveyId, "single-use-settings"), {
    method: "PUT",
    body,
  });
