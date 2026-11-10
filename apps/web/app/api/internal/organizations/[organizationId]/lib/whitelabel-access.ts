import "server-only";
import { requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import { forbidOnRefusal } from "@/app/api/internal/lib/refusal";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { checkWhiteLabelPermission } from "@/modules/ee/whitelabel/email-customization/lib/permission";

export type TWhiteLabelRequestContext = {
  authentication: TV3Authentication;
  organizationId: string;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/** Name the target before anything can refuse, so a refusal's audit entry says what was attempted. */
export const recordOrganizationAuditTarget = ({ auditLog, organizationId }: TWhiteLabelRequestContext) => {
  if (!auditLog) return;
  auditLog.organizationId = organizationId;
  auditLog.targetId = organizationId;
};

/**
 * Authorize a whitelabel request on one organization, in the order the server actions it replaces used:
 * `organization.manage` (owners and managers), then — for a settings write — the organization's
 * state-mutation budget, then the whitelabel licence. A missing organization gets the same 403 as one the
 * caller can't see; a missing licence answers 403 with its reason, which the settings page shows.
 */
export async function requireWhiteLabelOrgAccess(
  { authentication, organizationId, requestId, instance }: TWhiteLabelRequestContext,
  { chargeStateMutation }: { chargeStateMutation: boolean }
): Promise<Response | { organizationId: string; userId: string }> {
  const access = await requireOrgActionAccess({
    authentication,
    organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  if (chargeStateMutation) {
    const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, organizationId, {
      requestId,
      instance,
    });
    if (limited) return limited;
  }

  const notLicensed = await forbidOnRefusal(
    () => checkWhiteLabelPermission(organizationId),
    requestId,
    instance
  );
  if (notLicensed) return notLicensed;

  return access;
}
