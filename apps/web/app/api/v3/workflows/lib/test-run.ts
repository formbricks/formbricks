import "server-only";
import type { TWorkflowIdInput } from "@formbricks/workflows";
import { applyV3OperationRateLimit } from "@/app/api/v3/lib/operation-rate-limit";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { buildWorkflowApiContext, workflowsHandlers } from "./context";

/**
 * `POST /api/v3/workflows/{workflowId}/test-runs` and the MCP `run_test` tool (ENG-7181, ADR 0049): the
 * per-principal budget (30 a minute, REST and MCP together), then the package's Test run operation,
 * which runs the draft with fake effects through `ctx.runTest` and answers with the finished run.
 * Audited as `testRunStarted` through the caller's audit log.
 */
export const startWorkflowTestRun = async ({
  authentication,
  requestId,
  instance,
  auditLog,
  params,
  req,
}: {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
  params: TWorkflowIdInput;
  /** Carries the JSON body (`{ payload? }`); the operation reads and validates it. */
  req: Request;
}): Promise<Response> => {
  const limited = await applyV3OperationRateLimit({
    config: rateLimitConfigs.api.v3WorkflowTestRuns,
    authentication,
    requestId,
    instance,
  });
  if (limited) return limited;

  return workflowsHandlers.createTestRun({
    req,
    ctx: buildWorkflowApiContext(authentication, requestId, instance, auditLog),
    params,
  });
};
