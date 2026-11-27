import "server-only";
import type { TWorkspaceRequestContext } from "@/app/api/internal/lib/types";
import { getV3SessionUserId } from "@/app/api/v3/lib/auth";
import { hubErrorToProblemResponse } from "@/app/api/v3/lib/hub-errors";
import {
  noContentResponse,
  problemBadGateway,
  problemForbidden,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import { assertCan } from "@/lib/authorization";
import {
  assertFeedbackDirectoryAssignmentAccess,
  assertRecordBelongsToWorkspace,
  ensureDeleteAccess,
  ensureReadAccess,
  getWorkspaceDirectoryIds,
} from "@/modules/ee/unify-feedback/lib/access";
import { getContactIdsByUserIds } from "@/modules/ee/unify-feedback/lib/contacts";
import { deleteFeedbackRecord, retrieveFeedbackRecord } from "@/modules/hub/service";

/**
 * Feedback records live in the Hub, one tenant per dataset. They are reached through a workspace: a
 * record is visible from a workspace only when its dataset is assigned there, which is also the
 * cross-organization boundary — a dataset belongs to exactly one organization.
 */

/** The session's user, or the 401 a session-only route answers without one. */
const requireSessionUser = ({
  authentication,
  requestId,
  instance,
}: TWorkspaceRequestContext): { userId: string } | Response => {
  const userId = getV3SessionUserId(authentication);
  return userId ? { userId } : problemUnauthorized(requestId, "Session required", instance);
};

/**
 * The record, once it is known to be reachable from the workspace and its dataset assignment is
 * readable. A record outside the workspace answers 403 like one the Hub doesn't know, so ids can't be
 * walked. Any other Hub answer goes through the shared mapping: a malformed id is the caller's 400, a Hub
 * that could not answer (or refused our credentials) a 502 or 503 — never a claim about the record. The
 * Hub's own text is never relayed beyond what that mapping allows.
 */
async function getReachableRecord(context: TWorkspaceRequestContext, userId: string, recordId: string) {
  const { workspaceId, requestId, instance } = context;
  const [workspaceDatasetIds, recordResult] = await Promise.all([
    getWorkspaceDirectoryIds(workspaceId),
    retrieveFeedbackRecord(recordId),
  ]);
  if (recordResult.error && recordResult.error.status !== 404) {
    return hubErrorToProblemResponse(recordResult.error, requestId, instance ?? "", {
      badGatewayDetail: "The feedback records could not be loaded.",
    });
  }
  if (!recordResult.data || recordResult.error) return problemForbidden(requestId, undefined, instance);

  assertRecordBelongsToWorkspace(workspaceDatasetIds, recordResult.data.tenant_id, recordId);
  await assertFeedbackDirectoryAssignmentAccess(userId, recordResult.data.tenant_id, workspaceId);
  return recordResult.data;
}

/** `GET /api/internal/feedback-records/{recordId}?workspaceId=`: a record and its taxonomy placement. */
export async function getFeedbackRecordOperation({
  recordId,
  ...context
}: TWorkspaceRequestContext & { recordId: string }): Promise<Response> {
  const { workspaceId, requestId } = context;
  const session = requireSessionUser(context);
  if (session instanceof Response) return session;
  const { userId } = session;
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
}: TWorkspaceRequestContext & { recordId: string }): Promise<Response> {
  const { workspaceId, requestId, instance, auditLog } = context;
  // Set before the access check so a refused or failed attempt is still attributable.
  if (auditLog) auditLog.targetId = recordId;
  const session = requireSessionUser(context);
  if (session instanceof Response) return session;
  const { userId } = session;

  const organizationId = await ensureDeleteAccess(userId, workspaceId);
  if (auditLog) auditLog.organizationId = organizationId;

  const record = await getReachableRecord(context, userId, recordId);
  if (record instanceof Response) return record;

  const deleted = await deleteFeedbackRecord(recordId);
  if (deleted.error) {
    // The record was just proven reachable from this workspace, so a 404 here (deleted meanwhile) leaks
    // nothing and is answered as one.
    return hubErrorToProblemResponse(deleted.error, requestId, instance ?? "", {
      badGatewayDetail: "The feedback records could not be deleted.",
      notFound: { resourceType: "Feedback record", resourceId: recordId },
    });
  }
  if (!deleted.data) {
    return problemBadGateway(requestId, "The feedback records could not be deleted.", instance);
  }

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
}: TWorkspaceRequestContext & { userIds: string[] }): Promise<Response> {
  const { workspaceId, requestId } = context;
  const session = requireSessionUser(context);
  if (session instanceof Response) return session;
  const { userId } = session;

  await assertCan({ type: "user", id: userId }, "workspace.read", { type: "workspace", id: workspaceId });
  return successResponse(await getContactIdsByUserIds(workspaceId, userIds), { requestId });
}
