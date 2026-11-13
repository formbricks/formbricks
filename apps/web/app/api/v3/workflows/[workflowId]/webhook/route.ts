/**
 * GET /api/v3/workflows/{workflowId}/webhook — the workflow's Webhook Secret URL, its last call and its
 * Sample payload. Write access only: the URL is a credential (ADR 0041). Thin adapter delegating to
 * @formbricks/workflows/server.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { buildWorkflowApiContext, workflowsHandlers } from "../../lib/context";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    workflowsHandlers.getWebhook({
      ctx: buildWorkflowApiContext(authentication, requestId, instance),
      params: parsedInput.params,
    }),
});
