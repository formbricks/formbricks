/**
 * GET /api/v3/workflows/{workflowId}/samples — the workflow's samples: the Webhook trigger's Sample
 * payload and each HTTP request step's last Test request response. Write access only. The editor
 * reads it to offer an HTTP request's response fields as Variables.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listWorkflowSamples } from "../../lib/samples";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    listWorkflowSamples({ authentication, requestId, instance, params: parsedInput.params }),
});
