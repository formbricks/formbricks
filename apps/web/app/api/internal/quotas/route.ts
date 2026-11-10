import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createQuotaOperation } from "./lib/operations";
import { ZQuotaBody } from "./schemas";

/** `POST /api/internal/quotas`: add a quota to the survey the body names. Licence-gated. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZQuotaBody },
  action: "created",
  targetType: "quota",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createQuotaOperation({ authentication, body: parsedInput.body, requestId, instance, auditLog }),
});
