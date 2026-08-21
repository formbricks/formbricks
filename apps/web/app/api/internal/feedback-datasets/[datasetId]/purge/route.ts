/**
 * POST /api/internal/feedback-datasets/{datasetId}/purge — delete every feedback record in a
 * dataset along with the topics generated from them, keeping the dataset itself and its sources.
 * Restricted to organization owners and managers (ENG-1770). Session-only.
 *
 * Internal surface: no OpenAPI entry and no stability promise, but every other v3 convention
 * applies (ENG-1668 / the Internal API RFC). The Hub runs the purge asynchronously, so this
 * responds 202 — the records are still present when it returns.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { purgeV3FeedbackDataset } from "../../lib/operations";
import { ZDatasetPathParams, ZDatasetPurgeQuery } from "../../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: {
    params: ZDatasetPathParams,
    query: ZDatasetPurgeQuery,
  },
  action: "purged",
  targetType: "feedbackDirectory",
  // Far below the shared v3 bucket: purging is irreversible and dataset-wide, so a burst is a bug
  // or an attack rather than legitimate use.
  customRateLimitConfig: rateLimitConfigs.api.internalDatasetPurge,
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    purgeV3FeedbackDataset({
      authentication,
      datasetId: parsedInput.params.datasetId,
      requestId,
      instance,
      auditLog,
    }),
});
