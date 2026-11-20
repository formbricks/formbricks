import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteQuotaOperation, updateQuotaOperation } from "../lib/operations";
import { ZQuotaBody, ZQuotaParams } from "../schemas";

/** `PUT /api/internal/quotas/{quotaId}`: replace the quota's settings. Licence-gated. */
export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZQuotaParams, body: ZQuotaBody },
  action: "updated",
  targetType: "quota",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateQuotaOperation({
      authentication,
      quotaId: parsedInput.params.quotaId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/quotas/{quotaId}`: delete the quota. Licence-gated. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZQuotaParams },
  action: "deleted",
  targetType: "quota",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteQuotaOperation({
      authentication,
      quotaId: parsedInput.params.quotaId,
      requestId,
      instance,
      auditLog,
    }),
});
