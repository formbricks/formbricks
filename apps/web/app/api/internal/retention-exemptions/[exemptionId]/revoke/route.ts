import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { revokeRetentionExemptionOperation } from "../../lib/operations";
import { ZRetentionExemptionPathParams } from "../../schemas";

/**
 * `POST /api/internal/retention-exemptions/{exemptionId}/revoke`: end an exemption now. A custom method
 * rather than `DELETE`, because the row is kept for history (ENG-3695).
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZRetentionExemptionPathParams },
  action: "revoked",
  targetType: "retentionExemption",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    revokeRetentionExemptionOperation({
      authentication,
      exemptionId: parsedInput.params.exemptionId,
      requestId,
      instance,
      auditLog,
    }),
});
