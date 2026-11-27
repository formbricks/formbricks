import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createInviteBatchOperation } from "../lib/create";
import { ZInviteBatchBody, ZInviteOrganizationQuery } from "../schemas";

/**
 * `POST /api/internal/invites/batches?organizationId=`: invite the rows of a CSV bulk import. Answers with
 * each row's outcome.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZInviteOrganizationQuery, body: ZInviteBatchBody },
  action: "created",
  targetType: "invite",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createInviteBatchOperation({
      authentication,
      organizationId: parsedInput.query.organizationId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
