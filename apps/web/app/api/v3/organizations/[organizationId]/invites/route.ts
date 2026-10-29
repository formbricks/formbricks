/**
 * POST /api/v3/organizations/{organizationId}/invites — invite a person as a member or manager.
 *
 * Nothing is sent unless the body carries `confirm: true`. Without it the call runs every check an invite
 * would face and answers 200 with `status: "preview"`, writing and mailing nothing. Organization owners and
 * managers, signed in as themselves; the operation enforces that and the role rules.
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { inviteV3OrganizationMember } from "../../lib/operations";

const organizationParamsSchema = z.object({
  organizationId: z.cuid2(),
});

export const POST = withV3ApiWrapper({
  auth: "session",
  action: "created",
  targetType: "invite",
  schemas: {
    params: organizationParamsSchema,
    query: ZV3EmptyQuery,
    // Parsed by the operation, so the MCP tool that calls it directly gets the same 400.
    body: z.unknown(),
  },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    inviteV3OrganizationMember({
      organizationId: parsedInput.params.organizationId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
