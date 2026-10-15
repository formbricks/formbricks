import type { TFeedbackRecordListQuery } from "@/app/api/internal/feedback-records/schemas";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";
import type { FeedbackRecordData, FeedbackRecordListResponse } from "@/modules/hub/types";

/** Client fetchers for the feedback records table and drawer. Every call throws a `V3ApiError` on a refusal. */

const BASE_PATH = "/api/internal/feedback-records";

const recordPath = (recordId: string, workspaceId: string) =>
  buildApiUrl(`${BASE_PATH}/${encodeURIComponent(recordId)}`, { workspaceId });

/** One page of one dataset's records. */
export const listFeedbackRecords = (
  query: TFeedbackRecordListQuery,
  { signal }: { signal?: AbortSignal } = {}
) => getApiData<FeedbackRecordListResponse>(buildApiUrl(BASE_PATH, query), { signal });

/** A record and its place in its dataset's taxonomy, when it has one. */
export const getFeedbackRecord = (recordId: string, workspaceId: string) =>
  getApiData<{ record: FeedbackRecordData; taxonomy: NonNullable<FeedbackRecordData["taxonomy"]> | null }>(
    recordPath(recordId, workspaceId)
  );

export const deleteFeedbackRecord = (recordId: string, workspaceId: string) =>
  sendApiRequest<void>(recordPath(recordId, workspaceId), { method: "DELETE" });

/** Resolve records' `user_id`s to this workspace's contact ids — at most 1000 per call. */
export const lookupFeedbackRecordContacts = (workspaceId: string, userIds: string[]) =>
  sendApiRequest<Record<string, string>>(buildApiUrl(`${BASE_PATH}/contact-lookups`, { workspaceId }), {
    method: "POST",
    body: { userIds },
  });
