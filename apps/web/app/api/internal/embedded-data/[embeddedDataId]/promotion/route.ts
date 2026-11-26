import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { promoteEmbeddedDataOperation } from "../../lib/operations";
import { ZEmbeddedDataIdParams, ZEmbeddedDataPromoteBody } from "../../schemas";

/** `POST /api/internal/embedded-data/{embeddedDataId}/promotion`: file a survey's local field in the library. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZEmbeddedDataIdParams, body: ZEmbeddedDataPromoteBody },
  action: "updated",
  targetType: "embeddedData",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    promoteEmbeddedDataOperation({
      authentication,
      embeddedDataId: parsedInput.params.embeddedDataId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
