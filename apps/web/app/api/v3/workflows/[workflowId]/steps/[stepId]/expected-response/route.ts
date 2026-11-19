/**
 * PUT /api/v3/workflows/{workflowId}/steps/{stepId}/expected-response — sets an HTTP request step's
 * expected response body (ADR 0054): the body its API answers with, whose fields are the step's Variables.
 * Only editors and API/MCP clients set it; a Test request never does. Write access. Audited as `updated`
 * on the workflow with the step id, never the body. The editor and the `set_expected_response` MCP tool
 * use the same operation.
 */
import { ZSetWorkflowExpectedResponseInput, ZWorkflowTestRequestParams } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { setWorkflowExpectedResponse } from "../../../../lib/expected-response";

export const PUT = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "workflow",
  schemas: { params: ZWorkflowTestRequestParams, body: ZSetWorkflowExpectedResponseInput },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) =>
    setWorkflowExpectedResponse({
      authentication,
      requestId,
      instance,
      auditLog,
      params: parsedInput.params,
      input: parsedInput.body,
    }),
});
