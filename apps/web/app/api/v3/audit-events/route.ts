/**
 * GET /api/v3/audit-events — an organization's audit events, newest first, keyset-paged.
 *
 * Session cookie, API key or OAuth token (ADR 0015). The caller must be an owner or manager of the
 * organization named in the query, or hold an API key with `manage` on one of its workspaces. Reads are
 * not audited.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3AuditEvents } from "./lib/operations";
import { ZV3AuditEventsListQuery } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3AuditEventsListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3AuditEvents({ authentication, query: parsedInput.query, requestId, instance }),
});
