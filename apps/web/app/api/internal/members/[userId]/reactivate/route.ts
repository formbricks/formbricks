import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { reactivateMemberOperation } from "./lib/operations";

/**
 * `POST /api/internal/members/{userId}/reactivate?organizationId=`: reactivate a deactivated member and
 * restart their data retention clock (ENG-3695). Internal and session-only.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: {
    params: z.object({ userId: z.cuid2() }).strict(),
    query: z.object({ organizationId: z.cuid2() }).strict(),
  },
  action: "reactivated",
  targetType: "user",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    reactivateMemberOperation({
      authentication,
      userId: parsedInput.params.userId,
      organizationId: parsedInput.query.organizationId,
      requestId,
      instance,
      auditLog,
    }),
});
