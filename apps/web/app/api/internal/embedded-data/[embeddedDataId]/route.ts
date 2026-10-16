import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteEmbeddedDataOperation, updateEmbeddedDataOperation } from "../lib/operations";
import { ZEmbeddedDataIdParams, ZEmbeddedDataUpdateBody } from "../schemas";

/** `PATCH /api/internal/embedded-data/{embeddedDataId}`: change a library field. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZEmbeddedDataIdParams, body: ZEmbeddedDataUpdateBody },
  action: "updated",
  targetType: "embeddedData",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateEmbeddedDataOperation({
      authentication,
      embeddedDataId: parsedInput.params.embeddedDataId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/embedded-data/{embeddedDataId}`: remove a library field no survey links. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZEmbeddedDataIdParams },
  action: "deleted",
  targetType: "embeddedData",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteEmbeddedDataOperation({
      authentication,
      embeddedDataId: parsedInput.params.embeddedDataId,
      requestId,
      instance,
      auditLog,
    }),
});
