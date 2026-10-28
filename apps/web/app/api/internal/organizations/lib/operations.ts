import "server-only";
import { logger } from "@formbricks/logger";
import { type TOrgAction, requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  createdResponse,
  noContentResponse,
  problemAIUnavailable,
  problemForbidden,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { isInstanceAIConfigured } from "@/lib/ai/service";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getHasNoOrganizations } from "@/lib/instance/service";
import { createMembership } from "@/lib/membership/service";
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  updateOrganization,
} from "@/lib/organization/service";
import { capturePostHogEvent, getEmailDomain, groupIdentifyPostHog } from "@/lib/posthog";
import { getUser } from "@/lib/user/service";
import { DEFAULT_WORKSPACE_NAME } from "@/lib/workspace/constants";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import type { TOrganizationCreateBody, TOrganizationPatchBody } from "../schemas";
import { serializeCreatedOrganization, serializeOrganizationSettings } from "../serializers";

type TRequestContext = {
  authentication: TV3Authentication;
  organizationId: string;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/** What a PATCH asks of the caller: renaming is the owner's; AI and display settings are managers' too. */
export const requiredOrganizationActions = (body: TOrganizationPatchBody): TOrgAction[] => {
  const actions = new Set<TOrgAction>();
  if (body.name !== undefined) actions.add("organization.write");
  if (body.isAISmartToolsEnabled !== undefined || body.displayTimeZone !== undefined) {
    actions.add("organization.manage");
  }
  return [...actions];
};

/** Name the target before anything can refuse, so a refusal's audit entry says what was attempted. */
const recordAuditTarget = ({ auditLog, organizationId }: TRequestContext) => {
  if (!auditLog) return;
  auditLog.organizationId = organizationId;
  auditLog.targetId = organizationId;
};

/** Authorize every action, in order; the first refusal is the answer. */
async function requireOrgActions(
  context: TRequestContext,
  actions: TOrgAction[]
): Promise<Response | { userId: string }> {
  let access: Awaited<ReturnType<typeof requireOrgActionAccess>> | undefined;
  for (const action of actions) {
    access = await requireOrgActionAccess({ ...context, action });
    if (access instanceof Response) return access;
  }
  if (!access) throw new Error("No organization action to authorize");
  return access;
}

/** `PATCH /api/internal/organizations/{organizationId}`: rename it, or change its AI or display settings. */
export async function updateOrganizationOperation({
  body,
  ...context
}: TRequestContext & { body: TOrganizationPatchBody }): Promise<Response> {
  const { organizationId, requestId, instance, auditLog } = context;
  recordAuditTarget(context);
  const access = await requireOrgActions(context, requiredOrganizationActions(body));
  if (access instanceof Response) return access;

  const organization = await getOrganization(organizationId);
  // Authorized for an organization that is gone by now: the same 403 as one the caller can't see.
  if (!organization) return problemForbidden(requestId, undefined, instance);

  const isEnablingAI = body.isAISmartToolsEnabled === true && !organization.isAISmartToolsEnabled;
  if (isEnablingAI && !isInstanceAIConfigured()) {
    return problemAIUnavailable(
      requestId,
      "AI is not configured on this instance.",
      "ai_instance_not_configured",
      instance
    );
  }

  const updated = await updateOrganization(organizationId, body);
  if (auditLog) {
    auditLog.oldObject = organization;
    auditLog.newObject = updated;
  }
  return successResponse(serializeOrganizationSettings(updated), { requestId });
}

/**
 * `DELETE /api/internal/organizations/{organizationId}`: delete it, with every workspace in it. Owners only,
 * and only where the licence allows more than one organization.
 */
export async function deleteOrganizationOperation(context: TRequestContext): Promise<Response> {
  const { organizationId, requestId, instance, auditLog } = context;
  recordAuditTarget(context);
  const access = await requireOrgActions(context, ["organization.write"]);
  if (access instanceof Response) return access;

  if (!(await getIsMultiOrgEnabled())) {
    return problemForbidden(requestId, "Organization deletion is disabled.", instance);
  }

  const organization = await getOrganization(organizationId);
  if (!organization) return problemForbidden(requestId, undefined, instance);

  await deleteOrganization(organizationId);
  if (auditLog) auditLog.oldObject = organization;
  return noContentResponse({ requestId });
}

/**
 * `POST /api/internal/organizations`: the organization a new account creates during setup, with its owner
 * membership and a first workspace. Allowed on a fresh instance, or anywhere the licence allows more than
 * one organization.
 */
export async function createOrganizationOperation({
  authentication,
  body,
  requestId,
  instance,
  auditLog,
}: Omit<TRequestContext, "organizationId"> & { body: TOrganizationCreateBody }): Promise<Response> {
  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);
  const user = await getUser(actor.id);
  if (!user) return problemUnauthorized(requestId, "Session required", instance);

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.createOrganization, user.id, {
    requestId,
    instance,
  });
  if (limited) return limited;

  const hasNoOrganizations = await getHasNoOrganizations();
  if (!hasNoOrganizations && !(await getIsMultiOrgEnabled())) {
    return problemForbidden(requestId, "This action can only be performed on a fresh instance.", instance);
  }

  const organization = await createOrganization({ name: body.name });
  await createMembership(organization.id, user.id, { role: "owner", accepted: true });

  // Stripe setup must run AFTER membership is created so the owner email is available.
  if (IS_FORMBRICKS_CLOUD) {
    ensureCloudStripeSetupForOrganization(organization.id).catch((error) => {
      logger.error(
        { error, organizationId: organization.id },
        "Stripe setup failed after organization creation"
      );
    });
  }

  // The organization was created just above and owns no workspaces, so there is no cap to enforce.
  const workspace = await createWorkspace(
    organization.id,
    { name: DEFAULT_WORKSPACE_NAME },
    { workspaceLimit: null }
  );

  if (auditLog) {
    auditLog.organizationId = organization.id;
    auditLog.targetId = organization.id;
    auditLog.newObject = organization;
  }

  groupIdentifyPostHog("organization", organization.id, {
    name: organization.name,
    email_domain: getEmailDomain(user.email),
  });
  groupIdentifyPostHog("workspace", workspace.id, { name: workspace.name });
  capturePostHogEvent(
    user.id,
    "organization_created",
    { organization_id: organization.id, is_first_org: hasNoOrganizations },
    { organizationId: organization.id, workspaceId: workspace.id }
  );
  capturePostHogEvent(
    user.id,
    "workspace_created",
    { organization_id: organization.id, workspace_id: workspace.id, name: workspace.name },
    { organizationId: organization.id, workspaceId: workspace.id }
  );

  return createdResponse(serializeCreatedOrganization(organization), {
    location: `/api/internal/organizations/${organization.id}`,
    requestId,
  });
}
