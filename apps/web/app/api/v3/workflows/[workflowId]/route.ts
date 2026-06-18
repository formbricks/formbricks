/**
 * /api/v3/workflows/{workflowId} — retrieve, update, and delete a single workflow.
 * Unknown / cross-workspace ids return 403 (not 404) to avoid leaking existence.
 *
 * Thin adapters: the wrapper validates the path param with the contract schema, then delegates to
 * the framework-agnostic handlers in `@formbricks/workflows/server`.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { buildWorkflowApiContext, workflowsHandlers } from "../lib/context";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    workflowsHandlers.get({
      ctx: buildWorkflowApiContext(authentication, requestId, instance),
      params: parsedInput.params,
    }),
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "workflow",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ req, parsedInput, authentication, requestId, instance }) =>
    workflowsHandlers.patch({
      req,
      ctx: buildWorkflowApiContext(authentication, requestId, instance),
      params: parsedInput.params,
    }),
});

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "workflow",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    workflowsHandlers.delete({
      ctx: buildWorkflowApiContext(authentication, requestId, instance),
      params: parsedInput.params,
    }),
});
