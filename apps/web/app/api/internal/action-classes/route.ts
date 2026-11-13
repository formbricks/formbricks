import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createActionClassOperation } from "./lib/operations";
import { ZActionClassCreateBody, ZActionClassWorkspaceQuery } from "./schemas";

/** `POST /api/internal/action-classes?workspaceId=`: create an action in the workspace. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZActionClassWorkspaceQuery, body: ZActionClassCreateBody },
  action: "created",
  targetType: "actionClass",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createActionClassOperation({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
