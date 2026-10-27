import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getRetentionExemptionOperation } from "../lib/operations";
import { ZRetentionExemptionPathParams } from "../schemas";

/** `GET /api/internal/retention-exemptions/{exemptionId}`: one exemption, active or not (ENG-3695). */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZRetentionExemptionPathParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getRetentionExemptionOperation({
      authentication,
      exemptionId: parsedInput.params.exemptionId,
      requestId,
      instance,
    }),
});
