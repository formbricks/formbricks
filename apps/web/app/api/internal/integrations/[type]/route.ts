import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteIntegrationOperation, putIntegrationOperation } from "../lib/operations";
import { ZIntegrationParams, ZIntegrationPutBody, ZIntegrationWorkspaceQuery } from "../schemas";

/** `PUT /api/internal/integrations/{type}?workspaceId=`: store an integration's mappings and settings. */
export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZIntegrationParams, query: ZIntegrationWorkspaceQuery, body: ZIntegrationPutBody },
  action: "createdUpdated",
  targetType: "integration",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    putIntegrationOperation({
      authentication,
      type: parsedInput.params.type,
      workspaceId: parsedInput.query.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/integrations/{type}?workspaceId=`: disconnect an integration. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZIntegrationParams, query: ZIntegrationWorkspaceQuery },
  action: "deleted",
  targetType: "integration",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteIntegrationOperation({
      authentication,
      type: parsedInput.params.type,
      workspaceId: parsedInput.query.workspaceId,
      requestId,
      instance,
      auditLog,
    }),
});
