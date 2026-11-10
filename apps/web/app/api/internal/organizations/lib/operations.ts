import "server-only";
import { logger } from "@formbricks/logger";
import type { TUserNotificationSettings } from "@formbricks/types/user";
import { getOrganizationsByUserId } from "@/app/(app)/workspaces/[workspaceId]/lib/organization";
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
import { getUser, updateUser } from "@/lib/user/service";
import { DEFAULT_WORKSPACE_NAME } from "@/lib/workspace/constants";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { listDashboardViewerOrganizations } from "@/modules/ee/analysis/lib/dashboard-viewer-access";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import type { TOrganizationCreateBody, TOrganizationPatchBody } from "../schemas";
import {
  serializeCreatedOrganization,
  serializeOrganizationOption,
  serializeOrganizationSettings,
} from "../serializers";

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

export const MULTI_ORG_DISABLED_DETAIL =
  "Creating Multiple organization is restricted on your instance of Formbricks";

/**
 * Whether this caller may create an organization, by the flow's own rule: `setup` on a fresh instance or
 * under a multi-organization licence, `additional` only under that licence. Answers the 403 with the reason
 * each flow's screen showed, or whether the instance had no organization yet.
 */
async function refuseOrganizationCreation(
  flow: NonNullable<TOrganizationCreateBody["flow"]>,
  { requestId, instance }: Pick<TRequestContext, "requestId" | "instance">
): Promise<{ refused: Response } | { hasNoOrganizations: boolean }> {
  if (flow === "additional") {
    if (!(await getIsMultiOrgEnabled())) {
      return { refused: problemForbidden(requestId, MULTI_ORG_DISABLED_DETAIL, instance) };
    }
    return { hasNoOrganizations: false };
  }

  const hasNoOrganizations = await getHasNoOrganizations();
  if (!hasNoOrganizations && !(await getIsMultiOrgEnabled())) {
    return {
      refused: problemForbidden(
        requestId,
        "This action can only be performed on a fresh instance.",
        instance
      ),
    };
  }
  return { hasNoOrganizations };
}

/**
 * `POST /api/internal/organizations`: a new organization with the caller as its owner and a first
 * workspace, from onboarding (`flow: "setup"`) or from the organization settings (`flow: "additional"`);
 * see `ZOrganizationCreateBody` for how the two differ.
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

  const flow = body.flow ?? "setup";
  const allowed = await refuseOrganizationCreation(flow, { requestId, instance });
  if ("refused" in allowed) return allowed.refused;
  // An additional organization is never the instance's first: the caller already belongs to one.
  const isFirstOrganization = flow === "setup" && allowed.hasNoOrganizations;

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
    { organization_id: organization.id, is_first_org: isFirstOrganization },
    { organizationId: organization.id, workspaceId: workspace.id }
  );
  capturePostHogEvent(
    user.id,
    "workspace_created",
    { organization_id: organization.id, workspace_id: workspace.id, name: workspace.name },
    { organizationId: organization.id, workspaceId: workspace.id }
  );

  if (flow === "additional") {
    // The creator starts unsubscribed from the new organization's alerts, as the settings action did.
    const updatedNotificationSettings: TUserNotificationSettings = {
      ...user.notificationSettings,
      alert: { ...user.notificationSettings?.alert },
      unsubscribedOrganizationIds: Array.from(
        new Set([...(user.notificationSettings?.unsubscribedOrganizationIds || []), organization.id]) // NOSONAR // We want to check for empty strings too
      ),
    };
    await updateUser(user.id, { notificationSettings: updatedNotificationSettings });
  }

  return createdResponse(serializeCreatedOrganization(organization), {
    location: `/api/internal/organizations/${organization.id}`,
    requestId,
  });
}

/**
 * `GET /api/internal/organizations`: the organizations the caller belongs to, as id and name, for the
 * organization switcher. The list is the caller's own authorization lookup, so it is scoped by
 * construction and takes no parameters: the organizations SpiceDB grants them `organization.read` on,
 * plus those where they are a Dashboard viewer (ADR-0025), whose relation reaches dashboard reads only.
 */
export async function listOrganizationsOperation({
  authentication,
  requestId,
  instance,
}: Pick<TRequestContext, "authentication" | "requestId" | "instance">): Promise<Response> {
  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);

  const [organizations, viewerOrganizations] = await Promise.all([
    getOrganizationsByUserId(actor.id),
    listDashboardViewerOrganizations(actor.id),
  ]);
  const known = new Set(organizations.map(({ id }) => id));
  const all = [...organizations, ...viewerOrganizations.filter(({ id }) => !known.has(id))];
  return successResponse(all.map(serializeOrganizationOption), { requestId });
}
