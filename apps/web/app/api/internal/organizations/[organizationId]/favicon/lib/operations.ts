import "server-only";
import { noContentResponse, successResponse } from "@/app/api/v3/lib/response";
import { updateOrganizationFaviconUrl } from "@/modules/ee/whitelabel/favicon-customization/lib/organization";
import {
  type TWhiteLabelRequestContext,
  recordOrganizationAuditTarget,
  requireWhiteLabelOrgAccess,
} from "../../lib/whitelabel-access";
import type { TOrganizationFaviconPutBody } from "../schemas";
import { serializeOrganizationFavicon } from "../serializers";

/**
 * `PUT /api/internal/organizations/{organizationId}/favicon`: set the favicon the organization's link
 * surveys show. Owners and managers, on the organization's state-mutation budget, where the licence
 * includes whitelabelling. Audited as `updated` on the organization, with the new favicon URL.
 */
export async function updateOrganizationFaviconOperation({
  body,
  ...context
}: TWhiteLabelRequestContext & { body: TOrganizationFaviconPutBody }): Promise<Response> {
  const { organizationId, requestId, auditLog } = context;
  recordOrganizationAuditTarget(context);
  const access = await requireWhiteLabelOrgAccess(context, { chargeStateMutation: true });
  if (access instanceof Response) return access;

  if (auditLog) auditLog.newObject = { faviconUrl: body.faviconUrl };
  await updateOrganizationFaviconUrl(organizationId, body.faviconUrl);

  return successResponse(serializeOrganizationFavicon(organizationId, body.faviconUrl), { requestId });
}

/**
 * `DELETE /api/internal/organizations/{organizationId}/favicon`: go back to the default favicon. The same
 * checks as setting one. Audited as `updated` on the organization.
 */
export async function removeOrganizationFaviconOperation(
  context: TWhiteLabelRequestContext
): Promise<Response> {
  const { organizationId, requestId, auditLog } = context;
  recordOrganizationAuditTarget(context);
  const access = await requireWhiteLabelOrgAccess(context, { chargeStateMutation: true });
  if (access instanceof Response) return access;

  if (auditLog) auditLog.oldObject = { faviconUrl: "" };
  await updateOrganizationFaviconUrl(organizationId, null);

  return noContentResponse({ requestId });
}
