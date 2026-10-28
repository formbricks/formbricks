/**
 * GET /api/v3/feedback-queries/field-catalog — the measures, dimensions, operators and limits a feedback
 * query may use. Session cookie, API key or OAuth token.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getV3FeedbackFieldCatalog } from "../lib/operations";
import { ZV3FeedbackFieldCatalogQuery } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3FeedbackFieldCatalogQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3FeedbackFieldCatalog({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      requestId,
      instance,
    }),
});
