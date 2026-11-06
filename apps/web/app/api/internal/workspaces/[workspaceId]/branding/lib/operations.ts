import "server-only";
import { requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getRemoveBrandingPermission } from "@/modules/ee/license-check/lib/utils";
import { updateWorkspaceBranding } from "@/modules/ee/whitelabel/remove-branding/lib/workspace";
import { getWorkspace } from "@/modules/survey/editor/lib/workspace";
import type { TWorkspaceBrandingPatchBody } from "../schemas";
import { serializeWorkspaceBranding } from "../serializers";

type TRequestContext = {
  authentication: TV3Authentication;
  workspaceId: string;
  body: TWorkspaceBrandingPatchBody;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/** Why the licence refuses: the in-app badge is checked first, as the Look & Feel page always has. */
const brandingRefusal = (body: TWorkspaceBrandingPatchBody) =>
  body.inAppSurveyBranding === undefined
    ? "You are not allowed to remove link survey branding"
    : "You are not allowed to remove in-app branding";

/**
 * `PATCH /api/internal/workspaces/{workspaceId}/branding`: show or hide the Formbricks badge on the
 * workspace's link and in-app surveys. Workspace managers only, and only where the licence (or the Cloud
 * plan) includes removing branding — re-showing the badge included, as before.
 */
export async function updateWorkspaceBrandingOperation({
  authentication,
  workspaceId,
  body,
  requestId,
  instance,
  auditLog,
}: TRequestContext): Promise<Response> {
  // Name the target before anything can refuse, so a refusal's audit entry says what was attempted. The
  // row is read once: its organization goes into the audit entry, and it is the entry's `oldObject`.
  if (auditLog) auditLog.targetId = workspaceId;
  const oldWorkspace = await getWorkspace(workspaceId);
  if (auditLog && oldWorkspace) auditLog.organizationId = oldWorkspace.organizationId;

  const access = await requireSessionWorkspaceAccess(
    authentication,
    workspaceId,
    "manage",
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  const { organizationId } = access;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, workspaceId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  // Gone since it was authorized: the same 403 as an organization the caller can't see.
  const organization = await getOrganization(organizationId);
  if (!organization) return problemForbidden(requestId, undefined, instance);
  if (!(await getRemoveBrandingPermission(organizationId))) {
    return problemForbidden(requestId, brandingRefusal(body), instance);
  }

  await updateWorkspaceBranding(workspaceId, body);
  const newWorkspace = await getWorkspace(workspaceId);
  if (!newWorkspace) return problemForbidden(requestId, undefined, instance);
  if (auditLog) {
    auditLog.oldObject = oldWorkspace;
    auditLog.newObject = newWorkspace;
  }

  const userId = authentication && "user" in authentication ? authentication.user.id : "";
  const groupContext = { organizationId, workspaceId };
  const brandingRemoved = [
    { type: "link", wasShown: oldWorkspace?.linkSurveyBranding, requested: body.linkSurveyBranding },
    { type: "in_app", wasShown: oldWorkspace?.inAppSurveyBranding, requested: body.inAppSurveyBranding },
  ] as const;
  for (const { type, wasShown, requested } of brandingRemoved) {
    if (wasShown === true && requested === false) {
      capturePostHogEvent(
        userId,
        "remove_branding_enabled",
        { organization_id: organizationId, workspace_id: workspaceId, branding_type: type },
        groupContext
      );
    }
  }

  return successResponse(serializeWorkspaceBranding(newWorkspace), { requestId });
}
