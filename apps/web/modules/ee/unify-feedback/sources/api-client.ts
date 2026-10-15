import type {
  TFeedbackSourceCreateBody,
  TFeedbackSourceImportResource,
  TFeedbackSourceUpdateBody,
  TFeedbackSourceWriteResource,
} from "@/app/api/internal/feedback-sources/schemas";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

/** Client fetchers for the feedback sources page. Every call throws a `V3ApiError` on a refusal. */

const BASE_PATH = "/api/internal/feedback-sources";

const sourcePath = (feedbackSourceId: string) => `${BASE_PATH}/${encodeURIComponent(feedbackSourceId)}`;

export const createFeedbackSource = (workspaceId: string, body: TFeedbackSourceCreateBody) =>
  sendApiRequest<TFeedbackSourceWriteResource>(buildApiUrl(BASE_PATH, { workspaceId }), {
    method: "POST",
    body,
  });

export const updateFeedbackSource = (feedbackSourceId: string, body: TFeedbackSourceUpdateBody) =>
  sendApiRequest<TFeedbackSourceWriteResource>(sourcePath(feedbackSourceId), { method: "PATCH", body });

export const deleteFeedbackSource = (feedbackSourceId: string) =>
  sendApiRequest<void>(sourcePath(feedbackSourceId), { method: "DELETE" });

/** Replay one mapped survey's past responses into a source. */
export const importFeedbackSourceResponses = (feedbackSourceId: string, surveyId: string) =>
  sendApiRequest<TFeedbackSourceImportResource>(`${sourcePath(feedbackSourceId)}/imports`, {
    method: "POST",
    body: { surveyId },
  });

/**
 * How many responses a survey has, for the import estimate — the public count endpoint, counted exactly
 * since it is scoped to one survey.
 */
export const getSurveyResponseCount = async (
  workspaceId: string,
  surveyId: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<number> =>
  (
    await getApiData<{ count: number; relation: "eq" | "gte" }>(
      buildApiUrl("/api/v3/responses/count", { workspaceId, surveyId, precision: "exact" }),
      { signal }
    )
  ).count;
