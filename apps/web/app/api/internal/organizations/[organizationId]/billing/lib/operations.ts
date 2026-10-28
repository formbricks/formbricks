import "server-only";
import { requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganization } from "@/lib/organization/service";
import { serializeOrganizationBillingLimits } from "../serializers";

/**
 * `GET /api/internal/organizations/{organizationId}/billing`: the organization's plan limits, for the
 * survey editor's upload size cap. Owners, managers and billing members only.
 */
export async function getOrganizationBillingOperation({
  authentication,
  organizationId,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  organizationId: string;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  const access = await requireOrgActionAccess({
    authentication,
    organizationId,
    action: "organization.manage_billing",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const organization = await getOrganization(organizationId);
  // Authorized for an organization that is gone by now: the same 403 as one the caller can't see.
  if (!organization) return problemForbidden(requestId, undefined, instance);

  return successResponse(serializeOrganizationBillingLimits(organization.billing), { requestId });
}
