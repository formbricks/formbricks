import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { revokeMcpGrantOperation, updateMcpGrantOperation } from "../lib/operations";
import { ZMcpGrantPathParams, ZMcpGrantUpdateBody } from "../lib/schemas";

/**
 * `PATCH /api/internal/mcp-grants/{clientId}`: Authorized apps' Edit (ENG-7152, ENG-7153). Replaces the
 * permissions of the session user's grant to the client, within its scopes, and its organization &
 * workspace access when given; applies from the client's next MCP call.
 * Internal and session-only; audited with the grant before and after.
 */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZMcpGrantPathParams, body: ZMcpGrantUpdateBody },
  action: "updated",
  targetType: "mcpGrant",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateMcpGrantOperation({
      authentication,
      clientId: parsedInput.params.clientId,
      permissions: parsedInput.body.permissions,
      access: parsedInput.body.access,
      requestId,
      instance,
      auditLog,
    }),
});

/**
 * `DELETE /api/internal/mcp-grants/{clientId}`: Authorized apps' Revoke. Ends the session user's grant to
 * the MCP client, its consent and its tokens; the client's next MCP call answers 401. Internal and
 * session-only; audited with the grant it ended.
 */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZMcpGrantPathParams },
  action: "deleted",
  targetType: "mcpGrant",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    revokeMcpGrantOperation({
      authentication,
      clientId: parsedInput.params.clientId,
      requestId,
      instance,
      auditLog,
    }),
});
