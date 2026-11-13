import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../../schemas";
import { finalizeSetupCheckoutUpgradeOperation } from "../lib/plan-operations";
import { ZBillingSetupCheckoutUpgradeBody } from "../schemas";

/** `POST /api/internal/organizations/{organizationId}/billing/setup-checkout-upgrades`: finalize the upgrade a completed setup checkout carried. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams, body: ZBillingSetupCheckoutUpgradeBody },
  action: "subscriptionAccessed",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    finalizeSetupCheckoutUpgradeOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
      body: parsedInput.body,
    }),
});
