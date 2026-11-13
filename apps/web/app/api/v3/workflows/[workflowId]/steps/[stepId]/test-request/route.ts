/**
 * POST /api/v3/workflows/{workflowId}/steps/{stepId}/test-request — one real call of an HTTP request
 * step from its saved or draft settings ("Send test request", ENG-7179). Write access, 30 per minute
 * per user or API key, not a run. Audited as `testRequestSent`. Thin adapter over the shared operation
 * the MCP `send_test_request` tool also calls.
 */
import { ZSendWorkflowTestRequestInput, ZWorkflowTestRequestParams } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { sendWorkflowTestRequest } from "../../../../lib/test-request";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "testRequestSent",
  targetType: "workflow",
  schemas: { params: ZWorkflowTestRequestParams, body: ZSendWorkflowTestRequestInput },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) =>
    sendWorkflowTestRequest({
      authentication,
      requestId,
      instance,
      auditLog,
      params: parsedInput.params,
      input: parsedInput.body,
    }),
});
