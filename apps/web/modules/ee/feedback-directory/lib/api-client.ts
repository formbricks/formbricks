import type {
  TDatasetCreateBody,
  TDatasetUpdateBody,
} from "@/app/api/internal/feedback-datasets/lib/schemas";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import type { TFeedbackDirectoryDetails } from "@/modules/ee/feedback-directory/types/feedback-directory";

/**
 * Client fetchers for the internal feedback-datasets routes (a dataset is a feedback directory). Every
 * call throws a parsed `V3ApiError` on a non-2xx response.
 */

const BASE_PATH = "/api/internal/feedback-datasets";

const datasetPath = (datasetId: string) => `${BASE_PATH}/${encodeURIComponent(datasetId)}`;

export type TPurgeFeedbackDatasetResponse = {
  datasetId: string;
  status: string;
};

/** Create a dataset in an organization, optionally assigned to some of its workspaces. */
export const createFeedbackDataset = (organizationId: string, body: TDatasetCreateBody) =>
  sendApiRequest<TFeedbackDirectoryDetails>(buildApiUrl(BASE_PATH, { organizationId }), {
    method: "POST",
    body,
  });

/** A dataset with its workspaces and sources. */
export const getFeedbackDataset = (datasetId: string, { signal }: { signal?: AbortSignal } = {}) =>
  getApiData<TFeedbackDirectoryDetails>(datasetPath(datasetId), { signal });

/** Rename a dataset, reassign its workspaces, or archive or unarchive it. Returns it as stored. */
export const updateFeedbackDataset = (datasetId: string, body: TDatasetUpdateBody) =>
  sendApiRequest<TFeedbackDirectoryDetails>(datasetPath(datasetId), { method: "PATCH", body });

/**
 * Ask the Hub to delete every feedback record in a dataset.
 *
 * Resolves once the purge has been *accepted*, not once it has run — the Hub performs it in the
 * background, so there is no deleted count and the records are still present when this returns.
 */
export const purgeFeedbackDataset = (datasetId: string) =>
  sendApiRequest<TPurgeFeedbackDatasetResponse>(`${datasetPath(datasetId)}/purge`, { method: "POST" });

/**
 * The service's error code behind a refused dataset write (`DIRECTORY_NAME_DUPLICATE`, …), for
 * `getTranslatedFeedbackDirectoryError`. Anything else falls back to its message, as it always did.
 */
export const getFeedbackDatasetErrorCode = (error: unknown): string => {
  if (error instanceof V3ApiError) {
    const reason = error.details?.reason;
    return typeof reason === "string" ? reason : error.detail;
  }
  return error instanceof Error ? error.message : "";
};
