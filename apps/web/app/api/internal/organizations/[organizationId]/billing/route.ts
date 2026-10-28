import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../schemas";
import { getOrganizationBillingOperation } from "./lib/operations";

/** `GET /api/internal/organizations/{organizationId}/billing`: the plan limits the survey editor reads. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getOrganizationBillingOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
    }),
});
