import "server-only";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { getV3SessionUserId, requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  createdResponse,
  noContentResponse,
  problemBadRequest,
  problemConflict,
  problemForbidden,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import {
  createLanguage,
  deleteLanguage,
  getLanguage,
  getSurveysUsingGivenLanguage,
  updateLanguage,
} from "@/lib/language/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { getUserVisibleSurveyWhere } from "@/lib/survey/visibility/actor-context";
import { getOrganizationIdFromWorkspaceId, getWorkspaceIdFromLanguageId } from "@/lib/utils/helper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TLanguageCreateBody, TLanguageUpdateBody } from "../schemas";
import {
  type TLanguageResource,
  type TLanguageSurveyResource,
  serializeLanguage,
  serializeLanguageSurvey,
} from "../serializers";

/**
 * A workspace's languages, for the workspace languages settings page.
 *
 * Every operation is `workspace.manage` on the workspace the language belongs to, and every write spends
 * the workspace's shared settings-write budget — the same checks the server actions these replace ran.
 * Single-language routes take a globally unique id and never a workspace, so the scope is read off the
 * row rather than supplied by the caller.
 */

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

type TLanguageScope = { workspaceId: string; organizationId: string; userId: string };

export const LANGUAGES_BASE_PATH = "/api/internal/languages";

const forbidden = ({ requestId, instance }: TRequestContext) =>
  problemForbidden(requestId, "You are not authorized to access this resource", instance);

const operationLog = ({ requestId }: TRequestContext) => logger.withContext({ requestId });

/**
 * Authorize `workspace.manage` on `workspaceId`. The organization is resolved first and written to the
 * audit entry, so a refused write still says where it was aimed; a workspace that does not exist answers
 * the same 403 as one the caller can't manage.
 */
async function authorizeWorkspaceManage(
  context: TRequestContext,
  workspaceId: string
): Promise<Response | TLanguageScope> {
  let organizationId: string;
  try {
    organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return forbidden(context);
    throw error;
  }
  if (context.auditLog) context.auditLog.organizationId = organizationId;

  const access = await requireSessionWorkspaceAccess(
    context.authentication,
    workspaceId,
    "manage",
    context.requestId,
    context.instance
  );
  if (access instanceof Response) return access;

  const userId = getV3SessionUserId(context.authentication);
  if (!userId) return forbidden(context);
  return { workspaceId: access.workspaceId, organizationId: access.organizationId, userId };
}

/**
 * Authorize `workspace.manage` on the workspace that owns a language. The language is named in the audit
 * entry before anything can refuse, and a missing language answers the same 403, byte for byte, as one in
 * a workspace the caller can't manage, so ids can't be walked.
 */
async function authorizeLanguage(
  context: TRequestContext,
  languageId: string
): Promise<Response | TLanguageScope> {
  if (context.auditLog) context.auditLog.targetId = languageId;

  let workspaceId: string;
  try {
    workspaceId = await getWorkspaceIdFromLanguageId(languageId);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return forbidden(context);
    throw error;
  }
  return authorizeWorkspaceManage(context, workspaceId);
}

/** Spend one unit of the workspace's settings-write budget, as the server actions did. */
const spendWriteBudget = (context: TRequestContext, workspaceId: string) =>
  applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, workspaceId, context);

/**
 * The language service's refusals, as answers. A code outside the catalog is the caller's input (400);
 * a language the workspace still needs — its default survey language, or one surveys or creatives use —
 * is a 409 whose message the settings page shows as it is (it names only surveys the caller may see,
 * ENG-3282). Everything else is mapped like any other v3 failure, so a row deleted mid-request is a 403.
 */
function mapLanguageError(error: unknown, context: TRequestContext, operation: string): Response {
  if (error instanceof ValidationError) {
    return problemBadRequest(context.requestId, error.message, {
      instance: context.instance,
      invalid_params: [{ name: "code", reason: error.message }],
    });
  }
  if (error instanceof OperationNotAllowedError) {
    return problemConflict(context.requestId, error.message, context.instance);
  }
  return mapV3ThrownError(error, {
    log: operationLog(context),
    requestId: context.requestId,
    instance: context.instance,
    operation,
  });
}

/** `POST /api/internal/languages?workspaceId=`: add a language to the workspace. */
export async function createLanguageOperation({
  workspaceId,
  body,
  ...context
}: TRequestContext & { workspaceId: string; body: TLanguageCreateBody }): Promise<Response> {
  const scope = await authorizeWorkspaceManage(context, workspaceId);
  if (scope instanceof Response) return scope;
  const limited = await spendWriteBudget(context, scope.workspaceId);
  if (limited) return limited;

  let created;
  try {
    created = await createLanguage(scope.workspaceId, body);
  } catch (error) {
    return mapLanguageError(error, context, "languages.create");
  }

  if (context.auditLog) {
    context.auditLog.targetId = created.id;
    context.auditLog.newObject = created;
  }
  capturePostHogEvent(
    scope.userId,
    "workspace_language_created",
    {
      organization_id: scope.organizationId,
      workspace_id: scope.workspaceId,
      language_code: created.code,
    },
    { organizationId: scope.organizationId, workspaceId: scope.workspaceId }
  );

  const resource: TLanguageResource = serializeLanguage(created);
  return createdResponse(resource, {
    requestId: context.requestId,
    location: `${LANGUAGES_BASE_PATH}/${created.id}`,
  });
}

/** `PATCH /api/internal/languages/{languageId}`: change a language's alias. */
export async function updateLanguageOperation({
  languageId,
  body,
  ...context
}: TRequestContext & { languageId: string; body: TLanguageUpdateBody }): Promise<Response> {
  const scope = await authorizeLanguage(context, languageId);
  if (scope instanceof Response) return scope;
  const limited = await spendWriteBudget(context, scope.workspaceId);
  if (limited) return limited;

  let updated;
  try {
    const before = await getLanguage(languageId);
    if (context.auditLog) context.auditLog.oldObject = before;
    updated = await updateLanguage(scope.workspaceId, languageId, body);
  } catch (error) {
    return mapLanguageError(error, context, "languages.update");
  }

  if (context.auditLog) context.auditLog.newObject = updated;
  return successResponse(serializeLanguage(updated), { requestId: context.requestId });
}

/**
 * `DELETE /api/internal/languages/{languageId}`: remove a language nothing uses. Refused with a 409 while
 * it is the workspace's default survey language or any survey or creative uses it.
 */
export async function deleteLanguageOperation({
  languageId,
  ...context
}: TRequestContext & { languageId: string }): Promise<Response> {
  const scope = await authorizeLanguage(context, languageId);
  if (scope instanceof Response) return scope;
  const limited = await spendWriteBudget(context, scope.workspaceId);
  if (limited) return limited;

  let deleted;
  try {
    // ENG-3282: the in-use refusal names only the surveys this caller may see.
    const visibleSurveyWhere = await getUserVisibleSurveyWhere(scope.userId, scope.organizationId);
    deleted = await deleteLanguage(languageId, scope.workspaceId, visibleSurveyWhere);
  } catch (error) {
    return mapLanguageError(error, context, "languages.delete");
  }

  // A delete has no "after", so the removed row is the whole record of what happened.
  if (context.auditLog) context.auditLog.oldObject = deleted;
  return noContentResponse({ requestId: context.requestId });
}

/**
 * `GET /api/internal/languages/{languageId}/surveys`: the surveys using a language, for the warning shown
 * before it is removed. ENG-3282: workspace manage is not survey access — only the surveys this caller
 * may see are named.
 */
export async function listLanguageSurveysOperation({
  languageId,
  ...context
}: TRequestContext & { languageId: string }): Promise<Response> {
  const scope = await authorizeLanguage(context, languageId);
  if (scope instanceof Response) return scope;

  try {
    const visibleSurveyWhere = await getUserVisibleSurveyWhere(scope.userId, scope.organizationId);
    const names = await getSurveysUsingGivenLanguage(languageId, visibleSurveyWhere);
    const resources: TLanguageSurveyResource[] = names.map(serializeLanguageSurvey);
    return successResponse(resources, { requestId: context.requestId });
  } catch (error) {
    return mapV3ThrownError(error, {
      log: operationLog(context),
      requestId: context.requestId,
      instance: context.instance,
      operation: "languages.surveys",
    });
  }
}
