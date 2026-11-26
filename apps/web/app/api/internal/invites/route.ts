import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createInviteOperation } from "./lib/create";
import { ZInviteCreateBody, ZInviteOrganizationQuery } from "./schemas";

/** `POST /api/internal/invites?organizationId=`: invite one person to the organization, by email. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZInviteOrganizationQuery, body: ZInviteCreateBody },
  action: "created",
  targetType: "invite",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createInviteOperation({
      authentication,
      organizationId: parsedInput.query.organizationId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
