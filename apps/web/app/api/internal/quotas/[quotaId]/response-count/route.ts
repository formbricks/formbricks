import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getQuotaResponseCountOperation } from "../../lib/operations";
import { ZQuotaParams } from "../../schemas";

/** `GET /api/internal/quotas/{quotaId}/response-count`: the responses the quota has screened in. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZQuotaParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getQuotaResponseCountOperation({
      authentication,
      quotaId: parsedInput.params.quotaId,
      requestId,
      instance,
    }),
});
