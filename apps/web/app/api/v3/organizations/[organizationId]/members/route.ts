/**
 * GET /api/v3/organizations/{organizationId}/members — list the people of an organization and its pending
 * invites. Session cookie only: it carries personal data and API keys carry no person. Any signed-in member
 * except the billing role; owners and managers also see two-factor state and teams (the operation decides).
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3OrganizationMembers } from "../../lib/members";
import { ZV3MemberListQuery } from "../../lib/members-schemas";

const organizationParamsSchema = z.object({
  organizationId: z.cuid2(),
});

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: organizationParamsSchema, query: ZV3MemberListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3OrganizationMembers({
      organizationId: parsedInput.params.organizationId,
      query: parsedInput.query,
      authentication,
      requestId,
      instance,
    }),
});
