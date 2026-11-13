import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createWorkspaceOperation, listWorkspacesOperation } from "./lib/operations";
import { ZWorkspaceCreateBody, ZWorkspacesCreateQuery, ZWorkspacesListQuery } from "./schemas";

/** `GET /api/internal/workspaces?organizationId=&access=`: the caller's workspaces in one organization. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZWorkspacesListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listWorkspacesOperation({
      authentication,
      organizationId: parsedInput.query.organizationId,
      access: parsedInput.query.access,
      requestId,
      instance,
    }),
});

/** `POST /api/internal/workspaces?organizationId=`: create a workspace in the organization. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZWorkspacesCreateQuery, body: ZWorkspaceCreateBody },
  action: "created",
  targetType: "workspace",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createWorkspaceOperation({
      authentication,
      organizationId: parsedInput.query.organizationId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
