import "server-only";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  problemForbidden,
  problemInternalError,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getTag, getTagsByWorkspaceId } from "@/lib/tag/service";
import { getTagsOnResponsesCount } from "@/lib/tagOnResponse/service";
import { deleteTag, mergeTags, updateTagName } from "@/modules/workspaces/settings/lib/tag";
import { serializeV3Tag } from "../serializers";

type TBaseParams = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
};

/**
 * Every mutation resolves the workspace from the tag itself rather than trusting a client-supplied
 * `workspaceId`. That keeps the scope unforgeable: a caller cannot pair someone else's tag id with a
 * workspace they happen to have access to. It also reproduces what the server actions did via
 * `getWorkspaceIdFromTagId`, so the authorization matrix is unchanged — organization owners and managers,
 * or a workspace team member with `readWrite`.
 *
 * An unknown tag answers 403, not 404, matching `/api/v3/surveys/{surveyId}` and
 * `/api/v3/workflows/{workflowId}`: a 404 here would let any signed-in user probe tag ids across the
 * whole instance and learn which exist.
 */
async function authorizeTagMutation(
  tagId: string,
  { authentication, requestId, instance }: TBaseParams
): Promise<Response | { tag: NonNullable<Awaited<ReturnType<typeof getTag>>>; organizationId: string }> {
  const tag = await getTag(tagId);
  if (!tag) {
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  const access = await requireV3WorkspaceAccess(
    authentication,
    tag.workspaceId,
    "readWrite",
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  return { tag, organizationId: access.organizationId };
}

export async function listV3Tags(params: TBaseParams & { workspaceId: string }): Promise<Response> {
  const { authentication, workspaceId, requestId, instance } = params;

  const access = await requireV3WorkspaceAccess(authentication, workspaceId, "read", requestId, instance);
  if (access instanceof Response) return access;

  const [tags, counts] = await Promise.all([
    getTagsByWorkspaceId(access.workspaceId),
    getTagsOnResponsesCount(access.workspaceId),
  ]);

  const countByTagId = new Map(counts.map((entry) => [entry.tagId, entry.count]));

  return successResponse(
    tags.map((tag) => serializeV3Tag(tag, countByTagId.get(tag.id) ?? 0)),
    { requestId }
  );
}

export async function renameV3Tag(
  params: TBaseParams & { tagId: string; name: string; auditLog?: TV3AuditLog }
): Promise<Response> {
  const { tagId, name, auditLog, requestId, instance } = params;

  const authorized = await authorizeTagMutation(tagId, params);
  if (authorized instanceof Response) return authorized;

  if (auditLog) {
    auditLog.organizationId = authorized.organizationId;
    auditLog.targetId = tagId;
    auditLog.oldObject = authorized.tag;
  }

  const result = await updateTagName(tagId, name);
  if (!result.ok) {
    // A duplicate name is the caller's problem, not a server fault: the component surfaces it inline.
    return problemUnprocessableContent(requestId, "Unable to update tag", {
      instance,
      invalid_params: [{ name: "name", reason: result.error.code ?? "invalid" }],
    });
  }

  if (auditLog) auditLog.newObject = result.data;

  return successResponse(serializeV3Tag(result.data, 0), { requestId });
}

export async function deleteV3Tag(
  params: TBaseParams & { tagId: string; auditLog?: TV3AuditLog }
): Promise<Response> {
  const { tagId, auditLog, requestId, instance } = params;

  const authorized = await authorizeTagMutation(tagId, params);
  if (authorized instanceof Response) return authorized;

  if (auditLog) {
    auditLog.organizationId = authorized.organizationId;
    auditLog.targetId = tagId;
  }

  const result = await deleteTag(tagId);
  if (!result.ok) {
    return problemInternalError(requestId, "Unable to delete tag", instance);
  }

  if (auditLog) auditLog.oldObject = result.data;

  return successResponse({ id: tagId }, { requestId });
}

export async function mergeV3Tags(
  params: TBaseParams & { tagId: string; newTagId: string; auditLog?: TV3AuditLog }
): Promise<Response> {
  const { tagId, newTagId, auditLog, requestId, instance } = params;

  const authorized = await authorizeTagMutation(tagId, params);
  if (authorized instanceof Response) return authorized;

  // Both tags must live in the same workspace, or merging would move responses across a tenant
  // boundary. The server action checked this too; it is the one rule that needs the second tag loaded.
  const target = await getTag(newTagId);
  if (!target) {
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }
  if (target.workspaceId !== authorized.tag.workspaceId) {
    return problemForbidden(requestId, "Tags must be in the same workspace", instance);
  }

  if (auditLog) {
    auditLog.organizationId = authorized.organizationId;
    auditLog.targetId = `${tagId}-${newTagId}`;
    auditLog.oldObject = authorized.tag;
  }

  const result = await mergeTags(tagId, newTagId);
  if (!result.ok) {
    return problemInternalError(requestId, "Unable to merge tags", instance);
  }

  if (auditLog) auditLog.newObject = result.data;

  return successResponse({ id: newTagId }, { requestId });
}
