import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../../schemas";
import { undoPendingPlanChangeOperation } from "../lib/plan-operations";

/** `DELETE /api/internal/organizations/{organizationId}/billing/pending-plan-change`: undo a scheduled downgrade. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams },
  action: "subscriptionAccessed",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    undoPendingPlanChangeOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
    }),
});
