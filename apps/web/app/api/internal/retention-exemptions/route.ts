import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createRetentionExemptionOperation, listRetentionExemptionsOperation } from "./lib/operations";
import { ZCreateRetentionExemptionBody, ZRetentionExemptionsListQuery } from "./schemas";

/**
 * `GET /api/internal/retention-exemptions?organizationId=&limit=&cursor=`: the active exemptions, for the
 * Data retention Exemptions tab. Internal (session-only, no OpenAPI entry), per ENG-3695. Reads aren't
 * audited (ENG-3615).
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZRetentionExemptionsListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listRetentionExemptionsOperation({ authentication, query: parsedInput.query, requestId, instance }),
});

/** `POST /api/internal/retention-exemptions`: exempt a survey from one policy until a date. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZCreateRetentionExemptionBody },
  action: "created",
  targetType: "retentionExemption",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createRetentionExemptionOperation({
      authentication,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
