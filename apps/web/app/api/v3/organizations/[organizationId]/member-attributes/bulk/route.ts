/**
 * PUT /api/v3/organizations/{organizationId}/member-attributes/bulk — set members' and pending invites'
 * Member attribute values, matched by email, up to 500 rows in one transaction. Each row replaces the
 * values of the keys it names; the result reports every row (updated member, updated invite, unknown
 * email, invalid). Member settings and the CSV import write through it.
 *
 * Session (Owners and Managers above the user-management floor) or an API key with Access Control write;
 * needs Access Control and Dashboards. Rate-limited on top of the v3 default.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { bulkSetV3MemberAttributes } from "../lib/operations";
import { ZV3BulkMemberAttributesBody, ZV3OrganizationParams } from "../lib/schemas";

export const PUT = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "memberAttributes",
  customRateLimitConfig: rateLimitConfigs.api.v3MemberAttributesBulk,
  schemas: { params: ZV3OrganizationParams, body: ZV3BulkMemberAttributesBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    bulkSetV3MemberAttributes({
      authentication,
      organizationId: parsedInput.params.organizationId,
      body: parsedInput.body,
      auditLog,
      requestId,
      instance,
    }),
});
