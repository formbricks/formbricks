import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { deleteResponseOperation, getResponseOperation } from "../lib/operations";
import { ZDeleteResponseQuery, ZResponseParams } from "../schemas";

/*
 * Not a twin of the public `/api/v3/responses/{responseId}` (ADR-0059): the card reads the response it
 * renders (`TResponseWithQuotas`, with its screened-in quotas), which v3 does not serve, and the delete takes
 * the card's `decrementQuotas` opt-in, which v3 leaves out on purpose (`app/api/v3/responses/lib/service.ts`).
 * The card moves to v3 once v3 serves both.
 */

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
