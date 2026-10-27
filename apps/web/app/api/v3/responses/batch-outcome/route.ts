/**
 * POST /api/v3/responses/batch-outcome — mark up to 100 responses Low quality, or restore them, in one
 * transaction.
 *
 * Modelled on `batch-delete`: a POST custom method with the workspace as a required scope, so the id list
 * is filtered by exactly what the caller was authorized against. It is a mutation that fans out to the
 * response pipeline, so it carries the state-mutation rate limit rather than the shared v3 default.
 *
 * A thin adapter on purpose: the orchestration lives in the operation and the service.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { batchSetV3ResponsesOutcome } from "../lib/operations";
import { ZV3BatchSetResponsesOutcomeBody, ZV3BatchSetResponsesOutcomeQuery } from "../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "response",
  customRateLimitConfig: rateLimitConfigs.api.v3StateMutation,
  schemas: { body: ZV3BatchSetResponsesOutcomeBody, query: ZV3BatchSetResponsesOutcomeQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    batchSetV3ResponsesOutcome({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      ids: parsedInput.body.ids,
      outcome: parsedInput.body.outcome,
      auditLog,
      requestId,
      instance,
    }),
});
