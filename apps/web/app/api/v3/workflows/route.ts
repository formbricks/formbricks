/**
 * /api/v3/workflows — list and create workflow management resources.
 * Session cookie or x-api-key; scope by workspaceId only.
 *
 * Thin adapter: authenticate via the shared wrapper, build the workflow API context, and delegate
 * to the framework-agnostic handlers in `@formbricks/workflows/server`.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { buildWorkflowApiContext, workflowsHandlers } from "./lib/context";

export const GET = withV3ApiWrapper({
  auth: "both",
  handler: async ({ req, authentication, requestId, instance }) =>
    workflowsHandlers.list({ req, ctx: buildWorkflowApiContext(authentication, requestId, instance) }),
});

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "workflow",
  handler: async ({ req, authentication, auditLog, requestId, instance }) =>
    workflowsHandlers.create({
      req,
      ctx: buildWorkflowApiContext(authentication, requestId, instance, auditLog),
    }),
});
