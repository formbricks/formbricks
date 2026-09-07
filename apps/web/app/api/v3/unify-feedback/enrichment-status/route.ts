/**
 * GET /api/v3/unify-feedback/enrichment-status — per-enrichment progress (translation, sentiment,
 * emotions) across a workspace's feedback directories. Feeds the indicator above the records table.
 * Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getV3EnrichmentStatus } from "./lib/operations";
import { ZEnrichmentStatusQuery } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: {
    query: ZEnrichmentStatusQuery,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3EnrichmentStatus({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      requestId,
      instance,
    }),
});
