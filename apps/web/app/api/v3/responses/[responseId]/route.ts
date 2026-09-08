/**
 * DELETE /api/v3/responses/{responseId} — delete one response.
 *
 * The workspace is resolved from the response, never from the request, so the caller cannot choose the
 * scope it is authorized against. Deletes at `manage`, per the AuthZed schema's own assignment of
 * "delete through the legacy management APIs" to that permission.
 *
 * A thin adapter on purpose: the orchestration lives in the operation and the service, which the MCP
 * server also calls directly with no wrapper around them.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { deleteV3Response } from "../lib/operations";
import { ZV3ResponseIdParams } from "../lib/schemas";

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "response",
  schemas: { params: ZV3ResponseIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3Response({
      authentication,
      responseId: parsedInput.params.responseId,
      auditLog,
      requestId,
      instance,
    }),
});
