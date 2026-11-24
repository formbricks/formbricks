import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../../schemas";
import { getUpgradeChargePreviewOperation } from "../lib/checkout-operations";
import { ZBillingUpgradeChargePreviewQuery } from "../schemas";

/** `GET /api/internal/organizations/{organizationId}/billing/upgrade-charge-preview`: what an immediate upgrade would charge now. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams, query: ZBillingUpgradeChargePreviewQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getUpgradeChargePreviewOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      query: parsedInput.query,
    }),
});
