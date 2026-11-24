import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getEmbeddedDataUsageOperation } from "../../lib/operations";
import { ZEmbeddedDataIdParams } from "../../schemas";

/** `GET /api/internal/embedded-data/{embeddedDataId}/usage`: the surveys linking a field. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZEmbeddedDataIdParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getEmbeddedDataUsageOperation({
      authentication,
      embeddedDataId: parsedInput.params.embeddedDataId,
      requestId,
      instance,
    }),
});
