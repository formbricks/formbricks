import type { McpServer } from "@modelcontextprotocol/server";
import { listV3AuditEventsFromInput } from "@/app/api/v3/audit-events/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpListAuditEventsInput,
  ZMcpAuditEventListOutput,
  ZMcpListAuditEventsInput,
} from "./audit-event-schemas";
import { registerScopedTool } from "./guard-scopes";

/**
 * The audit trail, read-only. Its own scope family (`audit:read`, ADR 0015): an audit record names people
 * and what they did, so it is not something a survey or response token should reach. The scope is the
 * first gate; the operation still requires an organization owner or manager (OAuth), or an API key with
 * `manage` on a workspace of that organization, and audit logging to be enabled on the instance.
 *
 * Deliberately no tool to write, change or delete an event: the trail is written by the actions it
 * records, and an agent that could edit it would make it worthless as evidence.
 */
export function registerAuditEventTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_audit_events",
    {
      title: "List audit events",
      description: [
        "List an organization's audit events, newest first: who (actor) did what (action) to which resource (target), when, and whether it succeeded or failed.",
        "Narrow by actor, action, target, status or a time range; page with the returned cursor.",
        "Events are summaries: the changed values are not returned.",
        "Only events written while audit logging was enabled exist.",
      ].join(" "),
      inputSchema: ZMcpListAuditEventsInput,
      outputSchema: ZMcpAuditEventListOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    ["audit:read"],
    async (input: TMcpListAuditEventsInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await listV3AuditEventsFromInput({
        input,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );
}
