import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getRetentionPoliciesOperation, updateRetentionPoliciesOperation } from "./lib/operations";
import { ZRetentionPoliciesPatchBody, ZRetentionPoliciesQuery } from "./schemas";

/**
 * `GET /api/internal/retention-policies?organizationId=`: the organisation's three data retention
 * policies as one document, for the Policies tab. Internal (session-only, no OpenAPI entry), per
 * ENG-3695. Reads aren't audited (ENG-3615).
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZRetentionPoliciesQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getRetentionPoliciesOperation({ authentication, query: parsedInput.query, requestId, instance }),
});

/** `PATCH /api/internal/retention-policies?organizationId=`: change one policy, including pausing it. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZRetentionPoliciesQuery, body: ZRetentionPoliciesPatchBody },
  action: "updated",
  targetType: "retentionPolicy",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateRetentionPoliciesOperation({
      authentication,
      query: parsedInput.query,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
