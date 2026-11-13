/**
 * PUT /api/v3/workflows/{workflowId}/steps/{stepId}/secret-headers/{headerName} — Replace on a secret
 * header (ENG-7179, ADR 0043): a new value written in place, so the enabled workflow uses it from its
 * next run without a new Enable. Write access, the default v3 rate limit, 204. Audited as
 * `secretHeaderReplaced` (or `secretHeaderSet` for a first value) with the header name only.
 */
import { ZReplaceWorkflowSecretHeaderInput, ZWorkflowSecretHeaderParams } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { replaceWorkflowSecretHeader } from "@/app/api/v3/workflows/lib/replace-secret-header";

export const PUT = withV3ApiWrapper({
  auth: "both",
  action: "secretHeaderReplaced",
  targetType: "workflow",
  schemas: { params: ZWorkflowSecretHeaderParams, body: ZReplaceWorkflowSecretHeaderInput },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) =>
    replaceWorkflowSecretHeader({
      authentication,
      requestId,
      instance,
      auditLog,
      params: parsedInput.params,
      input: parsedInput.body,
    }),
});
