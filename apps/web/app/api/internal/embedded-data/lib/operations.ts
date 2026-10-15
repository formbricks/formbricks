import "server-only";
import { InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  createdResponse,
  noContentResponse,
  problemBadRequest,
  problemConflict,
  problemForbidden,
  problemServiceUnavailable,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import {
  createSharedEmbeddedData,
  deleteSharedEmbeddedData,
  getEmbeddedDataUsage,
  getEmbeddedDataWorkspaceId,
  getLocalEmbeddedDataById,
  getSharedEmbeddedData,
  getSharedEmbeddedDataById,
  promoteEmbeddedDataToShared,
  updateSharedEmbeddedData,
} from "@/modules/embedded-data/lib/library";
import {
  EmbeddedDataInUseError,
  EmbeddedDataKeyConflictError,
  type TSharedEmbeddedData,
} from "@/modules/embedded-data/types";
import type { TEmbeddedDataCreateBody, TEmbeddedDataPromoteBody, TEmbeddedDataUpdateBody } from "../schemas";
import {
  type TEmbeddedDataConflictDetails,
  type TEmbeddedDataListItemResource,
  serializeEmbeddedData,
  serializeEmbeddedDataListItem,
} from "../serializers";

/**
 * The shared Embedded Data library, for the manager page and the survey editor.
 *
 * Thin on purpose: every invariant lives in the library service, and these operations only add what a
 * service call cannot do for itself — authorize the caller against the right workspace, bound the write
 * rate, record what happened, and turn the service's refusals into HTTP answers. Embedded Data is core,
 * so there is no entitlement gate.
 */

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

export const EMBEDDED_DATA_BASE_PATH = "/api/internal/embedded-data";

const authorizeWorkspace = (context: TRequestContext, workspaceId: string, permission: TTeamPermission) =>
  requireSessionWorkspaceAccess(
    context.authentication,
    workspaceId,
    permission,
    context.requestId,
    context.instance
  );

/**
 * Authorize against the workspace that owns a field, read off the row: single-field routes take a globally
 * unique id and never a workspace, so the scope cannot be supplied by the caller.
 *
 * A missing row gets the same 403, byte for byte, as a row in a workspace the caller can't reach, so the
 * route can't be used to walk ids. A write names its target in the audit entry before the check, so a
 * refused probe still says which field and organization it aimed at.
 */
async function authorizeField(
  context: TRequestContext,
  id: string,
  permission: TTeamPermission
): Promise<Response | { workspaceId: string }> {
  const workspaceId = await getEmbeddedDataWorkspaceId(id);
  if (!workspaceId) {
    return problemForbidden(
      context.requestId,
      "You are not authorized to access this resource",
      context.instance
    );
  }
  if (context.auditLog) {
    context.auditLog.targetId = id;
    context.auditLog.organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  }
  const access = await authorizeWorkspace(context, workspaceId, permission);
  return access instanceof Response ? access : { workspaceId };
}

/**
 * Run a library write and answer its refusals. The two an author has to act on are 409s carrying what
 * they collided with in `details` (see `TEmbeddedDataConflictDetails`), and record no audit event:
 * nothing was written. The service's other messages are written for the author and pass through.
 */
async function runWrite(
  context: TRequestContext,
  write: () => Promise<TSharedEmbeddedData>
): Promise<Response | TSharedEmbeddedData> {
  const { requestId, instance, auditLog } = context;
  const conflict = (detail: string, details: TEmbeddedDataConflictDetails) => {
    skipV3AuditLog(auditLog);
    return problemConflict(requestId, detail, instance, { details });
  };

  try {
    return await write();
  } catch (error) {
    // Before `InvalidInputError` and `OperationNotAllowedError`: each subclasses one of them.
    if (error instanceof EmbeddedDataKeyConflictError) {
      return conflict(error.message, { reason: "key_conflict", existingId: error.existingId });
    }
    if (error instanceof EmbeddedDataInUseError) {
      return conflict(error.message, { reason: "in_use", usage: error.usage });
    }
    if (error instanceof InvalidInputError) {
      return problemBadRequest(requestId, error.message, { instance });
    }
    // The library's only other refusal: writes wait while an online upgrade is in progress.
    if (error instanceof OperationNotAllowedError) {
      return problemServiceUnavailable(requestId, error.message, instance);
    }
    throw error;
  }
}

/** The workspace's library, each row with the number of surveys linking it. */
export async function listEmbeddedDataForWorkspace(
  workspaceId: string
): Promise<TEmbeddedDataListItemResource[]> {
  return (await getSharedEmbeddedData(workspaceId)).map(serializeEmbeddedDataListItem);
}

/** `GET /api/internal/embedded-data?workspaceId=`: the library, for anyone who can read the workspace. */
export async function listEmbeddedDataOperation({
  workspaceId,
  ...context
}: TRequestContext & { workspaceId: string }): Promise<Response> {
  const access = await authorizeWorkspace(context, workspaceId, "read");
  if (access instanceof Response) return access;
  return successResponse(await listEmbeddedDataForWorkspace(access.workspaceId), {
    requestId: context.requestId,
  });
}

/** `POST /api/internal/embedded-data?workspaceId=`: add a field to the library. */
export async function createEmbeddedDataOperation({
  workspaceId,
  body,
  ...context
}: TRequestContext & { workspaceId: string; body: TEmbeddedDataCreateBody }): Promise<Response> {
  // Authorized before anything is read about the workspace: an unauthorized caller learns nothing.
  const access = await authorizeWorkspace(context, workspaceId, "readWrite");
  if (access instanceof Response) return access;
  await applyRateLimit(rateLimitConfigs.actions.stateMutation, access.workspaceId);
  if (context.auditLog) context.auditLog.organizationId = access.organizationId;

  const result = await runWrite(context, () => createSharedEmbeddedData(access.workspaceId, body));
  if (result instanceof Response) return result;

  if (context.auditLog) {
    context.auditLog.targetId = result.id;
    context.auditLog.newObject = result;
  }
  return createdResponse(serializeEmbeddedData(result), {
    requestId: context.requestId,
    location: `${EMBEDDED_DATA_BASE_PATH}/${result.id}`,
  });
}

/** `GET /api/internal/embedded-data/{id}/usage`: the surveys linking a field, for the "used in" popover. */
export async function getEmbeddedDataUsageOperation({
  embeddedDataId,
  ...context
}: TRequestContext & { embeddedDataId: string }): Promise<Response> {
  const access = await authorizeField(context, embeddedDataId, "read");
  if (access instanceof Response) return access;
  return successResponse(await getEmbeddedDataUsage(embeddedDataId, access.workspaceId), {
    requestId: context.requestId,
  });
}

/** `PATCH /api/internal/embedded-data/{id}`: change a library field, for every survey linking it. */
export async function updateEmbeddedDataOperation({
  embeddedDataId,
  body,
  ...context
}: TRequestContext & { embeddedDataId: string; body: TEmbeddedDataUpdateBody }): Promise<Response> {
  const access = await authorizeField(context, embeddedDataId, "readWrite");
  if (access instanceof Response) return access;
  await applyRateLimit(rateLimitConfigs.actions.stateMutation, access.workspaceId);

  const { acknowledgeExistingResponses, ...patch } = body;
  const before = await getSharedEmbeddedDataById(embeddedDataId, access.workspaceId);
  const result = await runWrite(context, () =>
    updateSharedEmbeddedData(embeddedDataId, access.workspaceId, patch, { acknowledgeExistingResponses })
  );
  if (result instanceof Response) return result;

  if (context.auditLog) {
    context.auditLog.oldObject = before;
    context.auditLog.newObject = result;
  }
  return successResponse(serializeEmbeddedData(result), { requestId: context.requestId });
}

/** `DELETE /api/internal/embedded-data/{id}`: remove a library field no survey links. */
export async function deleteEmbeddedDataOperation({
  embeddedDataId,
  ...context
}: TRequestContext & { embeddedDataId: string }): Promise<Response> {
  const access = await authorizeField(context, embeddedDataId, "readWrite");
  if (access instanceof Response) return access;
  await applyRateLimit(rateLimitConfigs.actions.stateMutation, access.workspaceId);

  const result = await runWrite(context, () => deleteSharedEmbeddedData(embeddedDataId, access.workspaceId));
  if (result instanceof Response) return result;

  // A delete has no "after", so the removed row is the whole record of what happened.
  if (context.auditLog) context.auditLog.oldObject = result;
  return noContentResponse({ requestId: context.requestId });
}

/**
 * `POST /api/internal/embedded-data/{id}/promotion`: file a survey's local field in the library. The
 * survey keeps its link to the row, which is shared from then on. Audited as an update: it edits the
 * ownership columns of a row that already exists.
 */
export async function promoteEmbeddedDataOperation({
  embeddedDataId,
  body,
  ...context
}: TRequestContext & { embeddedDataId: string; body: TEmbeddedDataPromoteBody }): Promise<Response> {
  const access = await authorizeField(context, embeddedDataId, "readWrite");
  if (access instanceof Response) return access;
  await applyRateLimit(rateLimitConfigs.actions.stateMutation, access.workspaceId);

  // Read before the write, and local-scoped: once promote lands the row is shared, so this is the last
  // moment the "before" side exists to be read at all.
  const before = await getLocalEmbeddedDataById(embeddedDataId, access.workspaceId);
  const result = await runWrite(context, () =>
    promoteEmbeddedDataToShared(embeddedDataId, access.workspaceId, body)
  );
  if (result instanceof Response) return result;

  if (context.auditLog) {
    context.auditLog.oldObject = before;
    context.auditLog.newObject = result;
  }
  return successResponse(serializeEmbeddedData(result), { requestId: context.requestId });
}
