import "server-only";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import type { TWorkspace } from "@formbricks/types/workspace";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  problemConflict,
  problemForbidden,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { type TAuthorizationAction, can } from "@/lib/authorization";
import { isWorkspaceDefaultSurveyLanguage } from "@/lib/i18n/default-survey-language";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { getWorkspace } from "@/lib/workspace/service";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getRemoveBrandingPermission } from "@/modules/ee/license-check/lib/utils";
import { resolvePostWorkspaceDeletionDestination } from "@/modules/workspaces/settings/general/lib/delete-workspace";
import {
  WORKSPACE_DELETE_CONFIRMATION_ERROR,
  hasMatchingWorkspaceDeleteConfirmation,
} from "@/modules/workspaces/settings/general/lib/delete-workspace-confirmation";
import { deleteWorkspaceIfNotLast, updateWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import type { TWorkspaceDeleteBody, TWorkspacePatchBody } from "../schemas";
import { type TWorkspaceDeletionResource, serializeWorkspaceSettings } from "../serializers";

type TRequestContext = {
  authentication: TV3Authentication;
  workspaceId: string;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

type TAuthorizedWorkspace = { userId: string; workspace: TWorkspace };

/**
 * Read the workspace, name it in the audit entry, then authorize `action` on `target`. The audit target is
 * recorded before anything can refuse, so a refused attempt still says which workspace and organization it
 * aimed at. A missing workspace and one the caller may not act on get the same 403, so ids can't be probed.
 */
async function authorizeWorkspace(
  { authentication, workspaceId, requestId, instance, auditLog }: TRequestContext,
  action: Extract<TAuthorizationAction, "workspace.manage" | "organization.manage">
): Promise<Response | TAuthorizedWorkspace> {
  if (auditLog) auditLog.targetId = workspaceId;

  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) return problemForbidden(requestId, undefined, instance);
  if (auditLog) auditLog.organizationId = workspace.organizationId;

  // Settings are the workspace's to manage; deleting it is its organization's (owners and managers).
  const allowed =
    action === "workspace.manage"
      ? await can(actor, "workspace.manage", { type: "workspace", id: workspaceId })
      : await can(actor, "organization.manage", { type: "organization", id: workspace.organizationId });
  if (!allowed) return problemForbidden(requestId, undefined, instance);

  return { userId: actor.id, workspace };
}

/**
 * Turning either survey branding off needs the licence's remove-branding entitlement; turning it back on
 * needs it too, as before. Null when the change is allowed, the refusal otherwise.
 */
async function refuseBrandingChange(
  body: TWorkspacePatchBody,
  organizationId: string,
  { requestId, instance }: TRequestContext
): Promise<Response | null> {
  const changesInApp = body.inAppSurveyBranding !== undefined;
  const changesLink = body.linkSurveyBranding !== undefined;
  if (!changesInApp && !changesLink) return null;

  if (!(await getOrganization(organizationId))) return problemForbidden(requestId, undefined, instance);
  if (await getRemoveBrandingPermission(organizationId)) return null;

  return problemForbidden(
    requestId,
    changesInApp
      ? "You are not allowed to remove in-app branding"
      : "You are not allowed to remove link survey branding",
    instance
  );
}

const captureBrandingRemoved = (
  userId: string,
  { organizationId, workspaceId }: { organizationId: string; workspaceId: string },
  brandingType: "link" | "in_app"
) =>
  capturePostHogEvent(
    userId,
    "remove_branding_enabled",
    { organization_id: organizationId, workspace_id: workspaceId, branding_type: brandingType },
    { organizationId, workspaceId }
  );

/** `PATCH /api/internal/workspaces/{workspaceId}`: the workspace settings pages' edits. Owners and managers. */
export async function updateWorkspaceOperation({
  body,
  ...context
}: TRequestContext & { body: TWorkspacePatchBody }): Promise<Response> {
  const { workspaceId, requestId, instance, auditLog } = context;
  const authorized = await authorizeWorkspace(context, "workspace.manage");
  if (authorized instanceof Response) return authorized;
  const { userId, workspace: oldWorkspace } = authorized;
  const { organizationId } = oldWorkspace;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, workspaceId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  const brandingRefusal = await refuseBrandingChange(body, organizationId, context);
  if (brandingRefusal) return brandingRefusal;

  // The default survey language has to be one of the workspace's own survey languages, so the setting
  // can never name a language the workspace does not have (ENG-2816). The body schema already limits it
  // to the languages the survey runtime ships strings for; this is the half that needs the workspace,
  // and it pairs with `deleteLanguage` refusing to remove the language it points at.
  const nextDefaultSurveyLanguage = body.config?.defaultSurveyLanguage;
  if (
    nextDefaultSurveyLanguage &&
    !oldWorkspace.languages.some((language) =>
      isWorkspaceDefaultSurveyLanguage(language.code, nextDefaultSurveyLanguage)
    )
  ) {
    const detail = "The default survey language must be one of the workspace's survey languages";
    return problemUnprocessableContent(requestId, detail, {
      instance,
      invalid_params: [{ name: "config.defaultSurveyLanguage", reason: detail }],
    });
  }

  // `config` is a JSON column, which Prisma replaces wholesale rather than merging. Merging the caller's
  // keys onto what is stored *now* means a partial write only touches the keys it names: a settings page
  // that has been open a while can no longer revert a key some other surface has written since it
  // rendered. Callers send the fields they are changing, not a whole config.
  const data = body.config ? { ...body, config: { ...oldWorkspace.config, ...body.config } } : body;

  let updated: TWorkspace;
  try {
    updated = await updateWorkspace(workspaceId, data);
  } catch (error) {
    // The service's one refusal here: a logo save whose `expectedUpdatedAt` is stale. Its message tells
    // the user to reload, which is what the logo form shows.
    if (error instanceof OperationNotAllowedError) return problemConflict(requestId, error.message, instance);
    throw error;
  }

  if (auditLog) {
    auditLog.oldObject = oldWorkspace;
    auditLog.newObject = updated;
  }

  const group = { organizationId, workspaceId };
  if (oldWorkspace.linkSurveyBranding && body.linkSurveyBranding === false) {
    captureBrandingRemoved(userId, group, "link");
  }
  if (oldWorkspace.inAppSurveyBranding && body.inAppSurveyBranding === false) {
    captureBrandingRemoved(userId, group, "in_app");
  }

  return successResponse(serializeWorkspaceSettings(updated), { requestId });
}

/**
 * `DELETE /api/internal/workspaces/{workspaceId}`: delete the workspace, confirmed by typing its name.
 * Owners and managers of its organization, and never the organization's last workspace. Answers where the
 * dashboard goes next, and points the workspace cookie there.
 */
export async function deleteWorkspaceOperation({
  body,
  ...context
}: TRequestContext & { body: TWorkspaceDeleteBody }): Promise<Response> {
  const { workspaceId, requestId, instance, auditLog } = context;
  const authorized = await authorizeWorkspace(context, "organization.manage");
  if (authorized instanceof Response) return authorized;
  const { workspace } = authorized;

  // After authorization, so the confirmation can't be used to guess the name of a workspace one can't see.
  if (!hasMatchingWorkspaceDeleteConfirmation(body.confirmationName, workspace.name)) {
    return problemUnprocessableContent(requestId, WORKSPACE_DELETE_CONFIRMATION_ERROR, {
      instance,
      invalid_params: [{ name: "confirmationName", reason: WORKSPACE_DELETE_CONFIRMATION_ERROR }],
    });
  }

  if (auditLog) auditLog.oldObject = workspace;

  try {
    await deleteWorkspaceIfNotLast(workspaceId, workspace.organizationId);
  } catch (error) {
    // The guard's refusal: the organization's last workspace stays.
    if (error instanceof OperationNotAllowedError) return problemConflict(requestId, error.message, instance);
    throw error;
  }

  const resource: TWorkspaceDeletionResource = {
    destination: await resolvePostWorkspaceDeletionDestination(workspace),
  };
  return successResponse(resource, { requestId });
}
