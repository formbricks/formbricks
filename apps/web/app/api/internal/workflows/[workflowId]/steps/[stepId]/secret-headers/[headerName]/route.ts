/**
 * PUT /api/internal/workflows/{workflowId}/steps/{stepId}/secret-headers/{headerName} — Replace on a
 * secret header (ENG-7179, ADR 0043): a new value written in place, so the enabled workflow uses it from
 * its next run without a new Enable. Write access, the default v3 rate limit, 204. Audited as
 * `secretHeaderReplaced` (or `secretHeaderSet` for a first value) with the header name only.
 *
 * Internal (CODING_STANDARDS "API Design"): only the editor calls it, so it is session-only, with no
 * OpenAPI entry and no stability promise. API and MCP callers set secret values through the workflow
 * definition on create and patch.
 */
import { ZReplaceWorkflowSecretHeaderInput, ZWorkflowSecretHeaderParams } from "@formbricks/workflows";
import { replaceWorkflowSecretHeader } from "@/app/api/internal/workflows/lib/replace-secret-header";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";

export const PUT = withV3ApiWrapper({
  auth: "session",
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
