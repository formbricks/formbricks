/**
 * PATCH  /api/v3/unify-feedback/taxonomy/nodes/{nodeId} — rename a taxonomy node.
 * DELETE /api/v3/unify-feedback/taxonomy/nodes/{nodeId} — soft-remove a taxonomy node.
 * Session cookie, API key or OAuth token. Both change directory-level taxonomy state, so they are limited
 * to organization owners and managers, or to an API key whose workspace owns the directory alone.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { removeV3TaxonomyNode, renameV3TaxonomyNode } from "../../lib/operations";
import { ZNodeIdParams, ZRenameNodeBody, ZWorkspaceDirectoryQuery } from "../../lib/schemas";

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "feedbackDirectory",
  schemas: {
    body: ZRenameNodeBody,
    params: ZNodeIdParams,
  },
  handler: async ({ authentication, auditLog, parsedInput, requestId, instance }) =>
    renameV3TaxonomyNode({
      authentication,
      workspaceId: parsedInput.body.workspaceId,
      directoryId: parsedInput.body.directoryId,
      nodeId: parsedInput.params.nodeId,
      label: parsedInput.body.label,
      auditLog,
      requestId,
      instance,
    }),
});

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "feedbackDirectory",
  schemas: {
    query: ZWorkspaceDirectoryQuery,
    params: ZNodeIdParams,
  },
  handler: async ({ authentication, auditLog, parsedInput, requestId, instance }) =>
    removeV3TaxonomyNode({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      directoryId: parsedInput.query.directoryId,
      nodeId: parsedInput.params.nodeId,
      auditLog,
      requestId,
      instance,
    }),
});
