import "server-only";
import { requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { problemConflict, problemInternalError, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { createTag } from "@/lib/tag/service";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { TagError } from "@/modules/workspaces/settings/types/tag";
import type { TCreateTagBody } from "../schemas";
import { serializeTag } from "../serializers";

/**
 * `POST /api/internal/tags`: create a tag. Needs write access to the workspace (`workspace.write`) and is
 * charged to the workspace's state-mutation budget, as the server action was. A name the workspace already
 * has is a 409, which the tag picker words as "Tag already exists". Audited as `created`, with the tag.
 */
export async function createTagOperation({
  authentication,
  body,
  requestId,
  instance,
  auditLog,
}: {
  authentication: TV3Authentication;
  body: TCreateTagBody;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  const access = await requireSessionWorkspaceAccess(
    authentication,
    body.workspaceId,
    "readWrite",
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, access.workspaceId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  const result = await createTag(access.workspaceId, body.name);
  if (!result.ok) {
    if (result.error.code === TagError.TAG_NAME_ALREADY_EXISTS) {
      return problemConflict(requestId, result.error.message, instance);
    }
    // The service's message for anything else is the database's own, so it isn't passed to the caller.
    return problemInternalError(requestId, "Unable to create tag", instance);
  }

  if (auditLog) {
    auditLog.targetId = result.data.id;
    auditLog.newObject = result.data;
  }
  return successResponse(serializeTag(result.data), { requestId, status: 201 });
}
