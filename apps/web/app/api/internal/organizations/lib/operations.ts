import "server-only";
import { type TOrgAction, requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import {
  noContentResponse,
  problemAIUnavailable,
  problemForbidden,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { isInstanceAIConfigured } from "@/lib/ai/service";
import { deleteOrganization, getOrganization, updateOrganization } from "@/lib/organization/service";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TOrganizationPatchBody } from "../schemas";
import { serializeOrganizationSettings } from "../serializers";

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
