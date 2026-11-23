/**
 * GET /api/v3/organizations/{organizationId}/member-attributes — members' and pending invites' Member
 * attribute values, keyed by attribute `key`: every member first, then every pending invite,
 * keyset-paginated across both. `search` matches name or email.
 *
 * Session (Owners and Managers) or an API key with Access Control read; needs Access Control and Dashboards.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3MemberAttributes } from "./lib/operations";
import { ZV3MemberAttributesListQuery, ZV3OrganizationParams } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3OrganizationParams, query: ZV3MemberAttributesListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3MemberAttributes({
      authentication,
      organizationId: parsedInput.params.organizationId,
      query: parsedInput.query,
      requestId,
      instance,
    }),
});
