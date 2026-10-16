import "server-only";
import {
  noContentResponse,
  problemBadGateway,
  problemForbidden,
  problemServiceUnavailable,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { assertCan } from "@/lib/authorization";
import { assertFeedbackSourceDirectoryAccess } from "@/lib/feedback-source/access";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import {
  assertFeedbackDirectoryAssignmentAccess,
  assertRecordBelongsToWorkspace,
  ensureDeleteAccess,
  ensureReadAccess,
  getWorkspaceDirectoryIds,
} from "@/modules/ee/unify-feedback/lib/access";
import { getContactIdsByUserIds } from "@/modules/ee/unify-feedback/lib/contacts";
import { deleteFeedbackRecord, listFeedbackRecords, retrieveFeedbackRecord } from "@/modules/hub/service";
import type { FeedbackRecordListParams } from "@/modules/hub/types";
import { type HubError, isHubNotConfigured } from "@/modules/hub/utils";
import type { TFeedbackRecordListQuery } from "../schemas";

/**
 * Feedback records live in the Hub, one tenant per dataset. They are reached through a workspace: a
 * record is visible from a workspace only when its dataset is assigned there, which is also the
 * cross-organization boundary — a dataset belongs to exactly one organization.
 */

type TRequestContext = {
  authentication: TV3Authentication;
  workspaceId: string;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

const FORBIDDEN = "You are not authorized to access this resource";

const sessionUserId = (authentication: TV3Authentication): string | null =>
  authentication && "user" in authentication ? (authentication.user?.id ?? null) : null;

/**
 * A Hub failure, naming what could not be done. The Hub's own error text is never relayed — it can carry
 * internal Hub URLs; it is logged in `@/modules/hub/service` and correlated by `requestId`.
 */
const hubFailure = (
  error: HubError | null | undefined,
  { requestId, instance }: Pick<TRequestContext, "requestId" | "instance">,
  failed: "loaded" | "deleted"
): Response =>
  error && isHubNotConfigured(error)
    ? problemServiceUnavailable(
        requestId,
        "The Hub integration is not configured on this deployment.",
        instance
      )
    : problemBadGateway(requestId, `The feedback records could not be ${failed}.`, instance);

/** The Hub answered about the record itself (absent, malformed id), rather than failing to answer. */
const isAnswerAboutRecord = (error: HubError): boolean => error.status >= 400 && error.status < 500;

/** `GET /api/internal/feedback-records?workspaceId=&datasetId=`: one page of one dataset's records. */
export async function listFeedbackRecordsOperation({
  query,
  ...context
}: Omit<TRequestContext, "workspaceId"> & { query: TFeedbackRecordListQuery }): Promise<Response> {
  const { authentication, requestId, instance } = context;
  const { workspaceId, datasetId } = query;
  const userId = sessionUserId(authentication);
  if (!userId) return problemForbidden(requestId, FORBIDDEN, instance);

  await assertCan({ type: "user", id: userId }, "workspace.read", { type: "workspace", id: workspaceId });
  // The dataset must be one of this workspace's: a dataset id alone is not a claim to its records.
  const datasets = await getFeedbackDirectoriesByWorkspaceId(workspaceId);
  if (!datasets.some(({ id }) => id === datasetId)) return problemForbidden(requestId, FORBIDDEN, instance);
  await assertFeedbackSourceDirectoryAccess(userId, datasetId, workspaceId, "read");

  const params: FeedbackRecordListParams = { tenant_id: datasetId, limit: query.limit ?? 50 };
  if (query.cursor) params.cursor = query.cursor;
  // One-element OR lists: Hub 0.8.4 made these filters repeatable, this caller stays single-valued.
  if (query.sourceType) params.source_type = [query.sourceType];
  if (query.fieldType) params.field_type = [query.fieldType];
  if (query.since) params.since = query.since;
  if (query.until) params.until = query.until;

  const result = await listFeedbackRecords(params);
  if (result.error || !result.data) return hubFailure(result.error, context, "loaded");
  return successResponse(result.data, { requestId });
}

/**
 * The record, once it is known to be reachable from the workspace and its dataset assignment is
 * readable. A record outside the workspace answers 403 like one that does not exist; a Hub that could not
 * answer is a 502 or 503, not a claim about the record.
 */
async function getReachableRecord(context: TRequestContext, userId: string, recordId: string) {
  const { workspaceId, requestId, instance } = context;
  const [workspaceDatasetIds, recordResult] = await Promise.all([
    getWorkspaceDirectoryIds(workspaceId),
    retrieveFeedbackRecord(recordId),
  ]);
  if (recordResult.error && !isAnswerAboutRecord(recordResult.error)) {
    return hubFailure(recordResult.error, context, "loaded");
  }
  if (!recordResult.data || recordResult.error) return problemForbidden(requestId, FORBIDDEN, instance);

  assertRecordBelongsToWorkspace(workspaceDatasetIds, recordResult.data.tenant_id, recordId);
  await assertFeedbackDirectoryAssignmentAccess(userId, recordResult.data.tenant_id, workspaceId);
  return recordResult.data;
}

/** `GET /api/internal/feedback-records/{recordId}?workspaceId=`: a record and its taxonomy placement. */
export async function getFeedbackRecordOperation({
  recordId,
  ...context
}: TRequestContext & { recordId: string }): Promise<Response> {
  const { authentication, workspaceId, requestId, instance } = context;
  const userId = sessionUserId(authentication);
  if (!userId) return problemForbidden(requestId, FORBIDDEN, instance);
  await ensureReadAccess(userId, workspaceId);

  const record = await getReachableRecord(context, userId, recordId);
  if (record instanceof Response) return record;

  // Classification is supplementary: an older Hub or a failed lookup returns no assignment, without
  // hiding the authorized record.
  return successResponse({ record, taxonomy: record.taxonomy ?? null }, { requestId });
}

/**
 * `DELETE /api/internal/feedback-records/{recordId}?workspaceId=`: delete a record. Organization owners
 * and managers only (ENG-1770): a record carries no workspace of its own.
 */
export async function deleteFeedbackRecordOperation({
  recordId,
  ...context
}: TRequestContext & { recordId: string }): Promise<Response> {
  const { authentication, workspaceId, requestId, instance, auditLog } = context;
  // Set before the access check so a refused or failed attempt is still attributable.
  if (auditLog) auditLog.targetId = recordId;
  const userId = sessionUserId(authentication);
  if (!userId) return problemForbidden(requestId, FORBIDDEN, instance);

  const organizationId = await ensureDeleteAccess(userId, workspaceId);
  if (auditLog) auditLog.organizationId = organizationId;

  const record = await getReachableRecord(context, userId, recordId);
  if (record instanceof Response) return record;

  const deleted = await deleteFeedbackRecord(recordId);
  if (!deleted.data || deleted.error) return hubFailure(deleted.error, context, "deleted");

  // Identify what was deleted without copying it: the value_* fields are end-user feedback, which has
  // no business being duplicated into the audit trail.
  if (auditLog) {
    auditLog.oldObject = {
      id: record.id,
      tenant_id: record.tenant_id,
      submission_id: record.submission_id,
      source_type: record.source_type,
      source_id: record.source_id,
      field_id: record.field_id,
      field_type: record.field_type,
      collected_at: record.collected_at,
    };
  }
  return noContentResponse({ requestId });
}

/**
 * `POST /api/internal/feedback-records/contact-lookups?workspaceId=`: resolve a page of records'
 * `user_id`s to this workspace's contact ids, for the contact links in the table. A read; POST because a
 * page of ids does not fit a URL.
 */
export async function lookupFeedbackRecordContactsOperation({
  userIds,
  ...context
}: TRequestContext & { userIds: string[] }): Promise<Response> {
  const { authentication, workspaceId, requestId, instance } = context;
  const userId = sessionUserId(authentication);
  if (!userId) return problemForbidden(requestId, FORBIDDEN, instance);

  await assertCan({ type: "user", id: userId }, "workspace.read", { type: "workspace", id: workspaceId });
  return successResponse(await getContactIdsByUserIds(workspaceId, userIds), { requestId });
}
