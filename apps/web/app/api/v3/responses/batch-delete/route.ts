/**
 * POST /api/v3/responses/batch-delete — delete up to 100 responses in one transaction.
 *
 * A POST custom method rather than a `DELETE` on the collection: a collection-level delete that loses
 * its filters — a client bug, a proxy stripping the query string, a copied curl command — degrades into
 * erasing every response in scope, and a distinct path cannot be reached by accident. AIP-165 blesses
 * `batchDelete` for exactly this reason.
 *
 * A thin adapter on purpose: the orchestration lives in the operation and the service, which the MCP
 * server also calls directly with no wrapper around them.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { batchDeleteV3Responses } from "../lib/operations";
import { ZV3BatchDeleteResponsesBody, ZV3BatchDeleteResponsesQuery } from "../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "response",
  schemas: { body: ZV3BatchDeleteResponsesBody, query: ZV3BatchDeleteResponsesQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    batchDeleteV3Responses({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      ids: parsedInput.body.ids,
      auditLog,
      requestId,
      instance,
    }),
});
