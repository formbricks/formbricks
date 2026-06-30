/**
 * /api/v3/workflows/runs — list workflow runs for a workspace (newest first).
 * Session cookie or x-api-key; scoped by the required `workspaceId` query param, with optional
 * `workflowId` / `responseId` / `filter[status][in]` / `filter[isDryRun][eq]` filters. A static
 * `runs` segment, so it never collides with `/api/v3/workflows/{workflowId}`.
 *
 * Thin adapter: authenticate via the shared wrapper, build the workflow API context, and delegate
 * to the framework-agnostic handlers in `@formbricks/workflows/server`.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { buildWorkflowApiContext, workflowsHandlers } from "../lib/context";

export const GET = withV3ApiWrapper({
  auth: "both",
  handler: async ({ req, authentication, requestId, instance }) =>
    workflowsHandlers.listRuns({ req, ctx: buildWorkflowApiContext(authentication, requestId, instance) }),
});
