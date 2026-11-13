import "server-only";
import {
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import type { TWorkspace } from "@formbricks/types/workspace";
import {
  getWorkspacesByUserId,
  getWritableWorkspacesByUserId,
} from "@/app/(app)/workspaces/[workspaceId]/lib/workspace";
import { requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import type { TWorkspaceRequestContext } from "@/app/api/internal/lib/types";
import { requireWorkspaceActionAccess } from "@/app/api/internal/lib/workspace-access";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  createdResponse,
  problemConflict,
  problemForbidden,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { type TAuthorizationAction, can } from "@/lib/authorization";
import { isWorkspaceDefaultSurveyLanguage } from "@/lib/i18n/default-survey-language";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, groupIdentifyPostHog } from "@/lib/posthog";
import { getUser, updateUser } from "@/lib/user/service";
import { getOrganizationWorkspacesCount, getWorkspace } from "@/lib/workspace/service";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { listDashboardViewerWorkspaces } from "@/modules/ee/analysis/lib/dashboard-viewer-access";
import {
  getAccessControlPermission,
  getOrganizationWorkspacesLimit,
} from "@/modules/ee/license-check/lib/utils";
import { getWorkspace as getEditorWorkspace } from "@/modules/survey/editor/lib/workspace";
import { resolvePostWorkspaceDeletionDestination } from "@/modules/workspaces/settings/general/lib/delete-workspace";
import {
  WORKSPACE_DELETE_CONFIRMATION_ERROR,
  hasMatchingWorkspaceDeleteConfirmation,
} from "@/modules/workspaces/settings/general/lib/delete-workspace-confirmation";
import {
  createWorkspace,
  deleteWorkspaceIfNotLast,
  updateWorkspace,
} from "@/modules/workspaces/settings/lib/workspace";
import type {
  TWorkspaceCreateBody,
  TWorkspaceDeletionBody,
  TWorkspacePatchBody,
  TWorkspacesListQuery,
} from "../schemas";
import {
  type TWorkspaceDeletionResource,
  serializeEditorWorkspace,
  serializeWorkspaceOption,
  serializeWorkspaceSettings,
} from "../serializers";

export const WORKSPACES_BASE_PATH = "/api/internal/workspaces";

type TAuthorizedWorkspace = { workspace: TWorkspace };

/**
 * Read the workspace, name it in the audit entry, then authorize `action` on `target`. The audit target is
 * recorded before anything can refuse, so a refused attempt still says which workspace and organization it
 * aimed at. A missing workspace and one the caller may not act on get the same 403, so ids can't be probed.
 */
async function authorizeWorkspace(
  { authentication, workspaceId, requestId, instance, auditLog }: TWorkspaceRequestContext,
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

  return { workspace };
}

/**
 * `GET /api/internal/workspaces/{workspaceId}`: the workspace as the survey editor refreshes it, without
 * its custom CSS. Asks `workspace.write`, as the `refetchWorkspaceAction` it replaces did: only the editor
 * reads it, and only someone who can edit the workspace's surveys opens the editor. A workspace that does
 * not exist answers the same 403 as one the caller can't write to.
 */
export async function getEditorWorkspaceOperation({
  authentication,
  workspaceId,
  requestId,
  instance,
}: Omit<TWorkspaceRequestContext, "auditLog">): Promise<Response> {
  const access = await requireWorkspaceActionAccess({
    authentication,
    workspaceId,
    action: "workspace.write",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const workspace = await getEditorWorkspace(workspaceId);
  if (!workspace) return problemForbidden(requestId, undefined, instance);
  return successResponse(serializeEditorWorkspace(workspace), { requestId });
}

/**
 * `PATCH /api/internal/workspaces/{workspaceId}`: the workspace settings pages' edits. Owners and managers.
 * Survey branding is not among them: `/branding` is its one write path, behind the licence check.
 */
export async function updateWorkspaceOperation({
  body,
  ...context
}: TWorkspaceRequestContext & { body: TWorkspacePatchBody }): Promise<Response> {
  const { workspaceId, requestId, instance, auditLog } = context;
  const authorized = await authorizeWorkspace(context, "workspace.manage");
  if (authorized instanceof Response) return authorized;
  const { workspace: oldWorkspace } = authorized;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, workspaceId, {
    requestId,
    instance,
  });
  if (limited) return limited;

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

  return successResponse(serializeWorkspaceSettings(updated), { requestId });
}

/**
 * `POST /api/internal/workspaces/{workspaceId}/deletions`: delete the workspace, confirmed by typing its name.
 * Owners and managers of its organization, and never the organization's last workspace. Answers where the
 * dashboard goes next, and points the workspace cookie there.
 */
export async function deleteWorkspaceOperation({
  body,
  ...context
}: TWorkspaceRequestContext & { body: TWorkspaceDeletionBody }): Promise<Response> {
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

/**
 * `GET /api/internal/workspaces?organizationId=&access=`: the caller's workspaces in the organization, as id
 * and name. `read` lists every workspace the caller can open, for the switchers, and asks only that the
 * caller belongs to the organization (any role, billing included). `write` lists the workspaces the caller
 * can write to, for picking a target to copy a survey into, and leaves billing members out.
 *
 * The organization gate is what scopes the list to one organization; the list itself is the caller's own
 * authorization lookup, so it never names a workspace the caller can't open. A Dashboard viewer has no
 * `organization.read` (ADR-0025): its switcher lists the workspaces its teams are granted, and no others.
 */
export async function listWorkspacesOperation({
  authentication,
  organizationId,
  access,
  requestId,
  instance,
}: Omit<TWorkspaceRequestContext, "workspaceId" | "auditLog"> & {
  organizationId: string;
  access: TWorkspacesListQuery["access"];
}): Promise<Response> {
  const actor = getV3AuthorizationActor(authentication);
  if (access === "read" && actor?.type === "user") {
    const membership = await getMembershipByUserIdOrganizationId(actor.id, organizationId);
    if (membership?.role === "dashboard_viewer") {
      const workspaces = await listDashboardViewerWorkspaces(actor.id, organizationId);
      return successResponse(workspaces.map(serializeWorkspaceOption), { requestId });
    }
  }

  const allowed = await requireOrgActionAccess({
    authentication,
    organizationId,
    action: access === "write" ? "organization.read_access" : "organization.read",
    requestId,
    instance,
  });
  if (allowed instanceof Response) return allowed;

  const workspaces =
    access === "write"
      ? await getWritableWorkspacesByUserId(allowed.userId, organizationId)
      : await getWorkspacesByUserId(allowed.userId, organizationId);
  return successResponse(workspaces.map(serializeWorkspaceOption), { requestId });
}

const WORKSPACE_LIMIT_REACHED = "Organization workspace limit reached";
const TEAM_ASSIGNMENT_NOT_ALLOWED = "You do not have permission to manage roles";

/** The service's refusals, past the checks this operation makes first, as problems. */
const createWorkspaceRefusal = (
  error: unknown,
  { requestId, instance }: Pick<TWorkspaceRequestContext, "requestId" | "instance">
) => {
  // The cap, checked again under the organization's lock: a concurrent create got there first (ENG-3921).
  if (error instanceof OperationNotAllowedError) return problemForbidden(requestId, error.message, instance);
  // The organization was deleted between the authorization and the lock.
  if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
  if (error instanceof InvalidInputError) return problemConflict(requestId, error.message, instance);
  // Duplicate team ids, or a team from another organization (ENG-1922). Both read the same, so the
  // answer can't be used to learn which teams exist elsewhere.
  if (error instanceof ValidationError) {
    return problemUnprocessableContent(requestId, error.message, {
      instance,
      invalid_params: [{ name: "teamIds", reason: error.message }],
    });
  }
  return null;
};

/**
 * `POST /api/internal/workspaces?organizationId=`: create a workspace in the organization, optionally
 * granted to some of its teams. Owners and managers, within the plan's workspace limit; granting teams
 * needs the access-control licence.
 */
export async function createWorkspaceOperation({
  authentication,
  organizationId,
  body,
  requestId,
  instance,
  auditLog,
}: Omit<TWorkspaceRequestContext, "workspaceId"> & {
  organizationId: string;
  body: TWorkspaceCreateBody;
}): Promise<Response> {
  // Named before anything can refuse, so a refused attempt's audit entry says which organization it aimed at.
  if (auditLog) auditLog.organizationId = organizationId;

  const access = await requireOrgActionAccess({
    authentication,
    organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  // Defence in depth for ENG-3921: bounds how wide a burst can be. The lock in `createWorkspace` is what
  // enforces the cap.
  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, organizationId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  // Authorized for an organization that is gone by now: the same 403 as one the caller can't see.
  if (!(await getOrganization(organizationId))) return problemForbidden(requestId, undefined, instance);

  const [workspaceLimit, workspaceCount] = await Promise.all([
    getOrganizationWorkspacesLimit(organizationId),
    getOrganizationWorkspacesCount(organizationId),
  ]);

  // A fast path for the common case, before the access-control lookup and the transaction. It cannot
  // enforce the cap on its own (concurrent requests all read the same count), so createWorkspace checks
  // again under a lock on the organization (ENG-3921).
  if (workspaceCount >= workspaceLimit) return problemForbidden(requestId, WORKSPACE_LIMIT_REACHED, instance);

  if (body.teamIds.length > 0 && !(await getAccessControlPermission(organizationId))) {
    return problemForbidden(requestId, TEAM_ASSIGNMENT_NOT_ALLOWED, instance);
  }

  let workspace: TWorkspace;
  try {
    workspace = await createWorkspace(
      organizationId,
      { name: body.name, teamIds: body.teamIds },
      { workspaceLimit }
    );
  } catch (error) {
    const refusal = createWorkspaceRefusal(error, { requestId, instance });
    if (refusal) return refusal;
    throw error;
  }

  if (auditLog) {
    auditLog.targetId = workspace.id;
    auditLog.newObject = workspace;
  }

  // Carried over from the server action this replaces: it re-saves the creator's notification settings,
  // a remnant of when creating a workspace subscribed its creator to the workspace's weekly summary.
  const user = await getUser(access.userId);
  if (user) {
    await updateUser(user.id, {
      notificationSettings: {
        ...user.notificationSettings,
        alert: { ...user.notificationSettings?.alert },
      },
    });
  }

  groupIdentifyPostHog("workspace", workspace.id, { name: workspace.name });
  capturePostHogEvent(
    access.userId,
    "workspace_created",
    { organization_id: organizationId, workspace_id: workspace.id, name: workspace.name },
    { organizationId, workspaceId: workspace.id }
  );

  return createdResponse(serializeWorkspaceOption(workspace), {
    requestId,
    location: `${WORKSPACES_BASE_PATH}/${workspace.id}`,
  });
}
