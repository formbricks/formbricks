import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getRetentionHealthOperation } from "./lib/operations";
import { ZRetentionHealthQuery } from "./schemas";

/**
 * `GET /api/internal/retention-health?organizationId=`: what can keep data retention from working for
 * the organisation (no job runner, no recent run, no SMTP, a cleanup backlog), for the banners above
 * the Data retention tabs. Internal (session-only, no OpenAPI entry). Reads aren't audited (ENG-3615).
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZRetentionHealthQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getRetentionHealthOperation({ authentication, query: parsedInput.query, requestId, instance }),
});
