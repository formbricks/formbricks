import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { deleteResponseOperation, getResponseOperation } from "../lib/operations";
import { ZDeleteResponseQuery, ZResponseParams } from "../schemas";

/** `GET /api/internal/responses/{responseId}`: the response as the response card renders it. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZResponseParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getResponseOperation({ authentication, responseId: parsedInput.params.responseId, requestId, instance }),
});

/** `DELETE /api/internal/responses/{responseId}[?decrementQuotas=true]`: delete the response. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZResponseParams, query: ZDeleteResponseQuery },
  action: "deleted",
  targetType: "response",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteResponseOperation({
      authentication,
      responseId: parsedInput.params.responseId,
      decrementQuotas: parsedInput.query.decrementQuotas,
      requestId,
      instance,
      auditLog,
    }),
});
