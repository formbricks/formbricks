import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../../schemas";
import { reportUpgradePaymentIssueOperation } from "../lib/plan-operations";
import { ZBillingPaymentIssueBody } from "../schemas";

/** `POST /api/internal/organizations/{organizationId}/billing/payment-issues`: record an abandoned upgrade payment authentication. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams, body: ZBillingPaymentIssueBody },
  action: "subscriptionAccessed",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    reportUpgradePaymentIssueOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
      body: parsedInput.body,
    }),
});
