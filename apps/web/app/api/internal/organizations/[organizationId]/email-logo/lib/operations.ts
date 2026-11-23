import "server-only";
import { noContentResponse, successResponse } from "@/app/api/v3/lib/response";
import {
  removeOrganizationEmailLogoUrl,
  updateOrganizationEmailLogoUrl,
} from "@/modules/ee/whitelabel/email-customization/lib/organization";
import {
  type TWhiteLabelRequestContext,
  recordOrganizationAuditTarget,
  requireWhiteLabelOrgAccess,
} from "../../lib/whitelabel-access";
import type { TOrganizationEmailLogoPutBody } from "../schemas";
import { serializeOrganizationEmailLogo } from "../serializers";

/**
 * `PUT /api/internal/organizations/{organizationId}/email-logo`: set the logo the organization's emails
 * show. Owners and managers, on the organization's state-mutation budget, where the licence includes
 * whitelabelling. Audited as `updated` on the organization, with the new logo URL.
 */
export async function updateOrganizationEmailLogoOperation({
  body,
  ...context
}: TWhiteLabelRequestContext & { body: TOrganizationEmailLogoPutBody }): Promise<Response> {
  const { organizationId, requestId, auditLog } = context;
  recordOrganizationAuditTarget(context);
  const access = await requireWhiteLabelOrgAccess(context, { chargeStateMutation: true });
  if (access instanceof Response) return access;

  if (auditLog) auditLog.newObject = { logoUrl: body.logoUrl };
  await updateOrganizationEmailLogoUrl(organizationId, body.logoUrl);

  return successResponse(serializeOrganizationEmailLogo(organizationId, body.logoUrl), { requestId });
}

/**
 * `DELETE /api/internal/organizations/{organizationId}/email-logo`: go back to the Formbricks logo. The
 * same checks as setting one. Audited as `updated` on the organization.
 */
export async function removeOrganizationEmailLogoOperation(
  context: TWhiteLabelRequestContext
): Promise<Response> {
  const { organizationId, requestId, auditLog } = context;
  recordOrganizationAuditTarget(context);
  const access = await requireWhiteLabelOrgAccess(context, { chargeStateMutation: true });
  if (access instanceof Response) return access;

  if (auditLog) auditLog.oldObject = { logoUrl: "" };
  await removeOrganizationEmailLogoUrl(organizationId);

  return noContentResponse({ requestId });
}
