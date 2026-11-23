/**
 * POST /api/v3/workflows/{workflowId}/test-runs — a Test run of the workflow's draft (ENG-7181,
 * ADR 0049): runs at once, inside the request, with fake effects, and answers 201 with the finished
 * run (`isDryRun: true`, no version). Write access, 30 per minute per user or API key, never billed.
 * Audited as `testRunStarted`. Thin adapter over the shared operation the MCP `run_test` tool also
 * calls; `/test` (the setup check) is unchanged.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { startWorkflowTestRun } from "../../lib/test-run";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "testRunStarted",
  targetType: "workflow",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ req, parsedInput, authentication, auditLog, requestId, instance }) =>
    startWorkflowTestRun({
      authentication,
      requestId,
      instance,
      auditLog,
      params: parsedInput.params,
      req,
    }),
});
