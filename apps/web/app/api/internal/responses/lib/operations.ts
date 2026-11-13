import "server-only";
import { revalidatePath } from "next/cache";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import type { TResponse } from "@formbricks/types/responses";
import { type TResponseAction, requireResponseActionAccess } from "@/app/api/internal/lib/response-access";
import type { TRequestContext } from "@/app/api/internal/lib/types";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { noContentResponse, problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { deleteResponse, getResponse, getResponseWithQuotas } from "@/lib/response/service";
import { addTagToRespone, deleteTagOnResponse } from "@/lib/tagOnResponse/service";
import { getOrganizationIdFromWorkspaceId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { getTag } from "@/lib/utils/services";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { type TResponseTagResource, serializeResponseCard } from "../serializers";

/**
 * A single response, for the response card: read it, delete it, and add or remove its tags. Every
 * operation authorizes the caller on the response itself (`response.read` / `response.write`), as the
 * server actions these replace did, and every write is charged to the workspace's state-mutation budget and
 * marks the survey's page for revalidation.
 */

/** Where a response lives: its survey, and the survey's workspace and organization. */
type TResponseScope = { surveyId: string; workspaceId: string; organizationId: string };

/** The response's scope, or `null` for a response, survey or workspace that is gone. */
const findResponseScope = async (responseId: string): Promise<TResponseScope | null> => {
  const response = await getResponse(responseId);
  if (!response) return null;
  try {
    const workspaceId = await getWorkspaceIdFromSurveyId(response.surveyId);
    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
    return { surveyId: response.surveyId, workspaceId, organizationId };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return null;
    throw error;
  }
};

/** The survey's results pages, which a change to one of its responses makes stale. */
const revalidateSurveyPages = ({ workspaceId, surveyId }: Pick<TResponseScope, "workspaceId" | "surveyId">) =>
  revalidatePath(`/workspaces/${workspaceId}/surveys/${surveyId}`);

/**
 * Authorize a write on the response, then charge the workspace's state-mutation budget, as the server
 * actions did. The organization goes into the audit entry once it is known, before a check can refuse.
 */
async function requireResponseWrite(
  context: TRequestContext,
  responseId: string,
  scope: TResponseScope
): Promise<Response | null> {
  const { requestId, instance, auditLog } = context;
  if (auditLog) auditLog.organizationId = scope.organizationId;

  const denied = await requireResponseAction(context, responseId, "response.write");
  if (denied) return denied;

  return applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, scope.workspaceId, {
    requestId,
    instance,
  });
}

/** `null` when the caller may take `action` on the response, or the 401/403 to answer with. */
async function requireResponseAction(
  { authentication, requestId, instance }: TRequestContext,
  responseId: string,
  action: TResponseAction
): Promise<Response | null> {
  const access = await requireResponseActionAccess({
    authentication,
    responseId,
    action,
    requestId,
    instance,
  });
  return access instanceof Response ? access : null;
}

/**
 * `GET /api/internal/responses/{responseId}`: the response as the card renders it, with its screened-in
 * quotas. An unknown response is denied by the resolver, so its existence can't be probed.
 */
export async function getResponseOperation({
  responseId,
  ...context
}: TRequestContext & { responseId: string }): Promise<Response> {
  const { requestId, instance } = context;
  const denied = await requireResponseAction(context, responseId, "response.read");
  if (denied) return denied;

  const response = await getResponseWithQuotas(responseId);
  if (!response) return problemForbidden(requestId, undefined, instance);
  return successResponse(serializeResponseCard(response), { requestId });
}

/**
 * `DELETE /api/internal/responses/{responseId}`: delete the response (its display, uploaded files and the
 * rest of `deleteResponse`'s clean-up), giving its quota places back when asked. Audited as `deleted`, with
 * the deleted response.
 */
export async function deleteResponseOperation({
  responseId,
  decrementQuotas,
  ...context
}: TRequestContext & { responseId: string; decrementQuotas: boolean }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  if (auditLog) auditLog.targetId = responseId;

  const scope = await findResponseScope(responseId);
  if (!scope) return problemForbidden(requestId, undefined, instance);

  const refused = await requireResponseWrite(context, responseId, scope);
  if (refused) return refused;

  let deleted: TResponse;
  try {
    deleted = await deleteResponse(responseId, decrementQuotas);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
    throw error;
  }

  if (auditLog) auditLog.oldObject = deleted;
  revalidateSurveyPages({ workspaceId: scope.workspaceId, surveyId: deleted.surveyId });
  return noContentResponse({ requestId });
}

/**
 * The response and the tag, resolved and checked to share a workspace, or `null` when either is gone or
 * they don't: a tag from another workspace answers the same 403 as one that doesn't exist.
 */
async function findResponseTagScope(responseId: string, tagId: string): Promise<TResponseScope | null> {
  const [scope, tag] = await Promise.all([findResponseScope(responseId), getTag(tagId)]);
  if (!scope || !tag || tag.workspaceId !== scope.workspaceId) return null;
  return scope;
}

/**
 * `PUT /api/internal/responses/{responseId}/tags/{tagId}`: put a tag on the response. Idempotent, as the
 * service is: a tag already on it answers the same. Audited as the tag's `addedToResponse`.
 */
export async function addResponseTagOperation({
  responseId,
  tagId,
  ...context
}: TRequestContext & { responseId: string; tagId: string }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  if (auditLog) auditLog.targetId = tagId;

  const scope = await findResponseTagScope(responseId, tagId);
  if (!scope) return problemForbidden(requestId, undefined, instance);

  const refused = await requireResponseWrite(context, responseId, scope);
  if (refused) return refused;

  const link: TResponseTagResource = await addTagToRespone(responseId, tagId);
  if (auditLog) auditLog.newObject = link;
  revalidateSurveyPages(scope);
  return successResponse({ responseId: link.responseId, tagId: link.tagId }, { requestId });
}

/**
 * `DELETE /api/internal/responses/{responseId}/tags/{tagId}`: take a tag off the response. Audited as the
 * tag's `removedFromResponse`.
 */
export async function removeResponseTagOperation({
  responseId,
  tagId,
  ...context
}: TRequestContext & { responseId: string; tagId: string }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  if (auditLog) auditLog.targetId = tagId;

  const scope = await findResponseTagScope(responseId, tagId);
  if (!scope) return problemForbidden(requestId, undefined, instance);

  const refused = await requireResponseWrite(context, responseId, scope);
  if (refused) return refused;

  const link = await deleteTagOnResponse(responseId, tagId);
  if (auditLog) auditLog.oldObject = link;
  revalidateSurveyPages(scope);
  return noContentResponse({ requestId });
}
