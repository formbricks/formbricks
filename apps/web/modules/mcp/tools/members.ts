import type { McpServer } from "@modelcontextprotocol/server";
import {
  listV3OrganizationMembers,
  removeV3OrganizationMember,
  updateV3OrganizationMemberRole,
} from "@/app/api/v3/organizations/lib/members";
import {
  type TV3MemberRemoveResource,
  type TV3MemberRoleUpdateResource,
  type TV3MemberRow,
  ZV3MemberRemoveResource,
  ZV3MemberRoleUpdateResource,
  ZV3MemberRow,
} from "@/app/api/v3/organizations/lib/members-schemas";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import { plural, withIdSummary } from "./id-summary";
import { runIdSummaryMutation } from "./id-summary-mutation";
import {
  type TMcpListMembersInput,
  type TMcpRemoveMemberInput,
  type TMcpUpdateMemberRoleInput,
  ZMcpListMembersInput,
  ZMcpRemoveMemberInput,
  ZMcpUpdateMemberRoleInput,
} from "./members-schemas";
import { mcpToolOutput } from "./output-schemas";
import { MEMBER_READ_SCOPES, MEMBER_WRITE_SCOPES } from "./setup-scopes";

const ZMcpMemberListOutput = mcpToolOutput(ZV3MemberRow.array());
const ZMcpMemberRoleUpdateOutput = mcpToolOutput(ZV3MemberRoleUpdateResource);
const ZMcpMemberRemoveOutput = mcpToolOutput(ZV3MemberRemoveResource);

/**
 * What the model reads after `list_members`: counts only. Names and emails are written by other people
 * (ADR 0017) and travel in `structuredContent`; so does `meta.nextCursor`.
 */
export const summarizeMemberList = (rows: TV3MemberRow[]): string => {
  const members = rows.filter((row) => row.kind === "member").length;
  return `${plural(members, "member")} and ${plural(rows.length - members, "pending invite")} on this page. Names, emails, roles and ids are in structuredContent; meta.nextCursor is set when there are more.`;
};

const summarizeRoleUpdate = (change: TV3MemberRoleUpdateResource): string => {
  if (change.status === "preview") {
    return `Not changed: a preview of changing member ${change.userId} from role ${change.previousRole} to ${change.role}${change.lowersAccess ? " (lowers access)" : ""}. Call again with confirm true after the person approves.`;
  }
  if (change.status === "unchanged") return `Member ${change.userId} already has role ${change.role}.`;
  return `Member ${change.userId} now has role ${change.role}.`;
};

const summarizeRemoval = (removal: TV3MemberRemoveResource): string =>
  removal.status === "preview"
    ? `Not removed: a preview of removing member ${removal.userId} (role ${removal.role}). Call again with confirm true after the person approves.`
    : `Member ${removal.userId} removed from organization ${removal.organizationId}.`;

export function registerMemberTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_members",
    {
      title: "List members",
      description:
        "List the people of an organization and its pending invites: name, email, role and status (two-factor and teams for owners and managers only). Needs a signed-in person who belongs to the organization (not an API key, not the billing role). Rows carry the ids the member and invite tools take. Ordered by id; page with meta.nextCursor, and meta.totalCount counts without paging.",
      inputSchema: ZMcpListMembersInput,
      outputSchema: ZMcpMemberListOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    MEMBER_READ_SCOPES,
    async ({ organizationId, ...query }: TMcpListMembersInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await listV3OrganizationMembers({
        organizationId,
        query,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return withIdSummary(
        await responseToMcpToolResult(response, requestId),
        ZV3MemberRow.array(),
        summarizeMemberList
      );
    }
  );

  registerScopedTool(
    server,
    "update_member_role",
    {
      title: "Change member role",
      description:
        "Change a member's organization role to member or manager (never owner or billing). Nothing changes unless confirm is true: without it you only get a preview, with lowersAccess saying whether the person would lose access, so show it and set confirm only after they approve. Needs an organization owner or manager (signed in, not an API key) and a plan with role management. You cannot change your own role; a manager can only assign member and cannot touch an owner; the last owner cannot be demoted. Pending invites cannot be re-roled: delete and invite again.",
      inputSchema: ZMcpUpdateMemberRoleInput,
      outputSchema: ZMcpMemberRoleUpdateOutput,
      audit: { action: "updated", targetType: "membership", targetIdArg: "userId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    MEMBER_WRITE_SCOPES,
    ({ organizationId, userId, ...body }: TMcpUpdateMemberRoleInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "updated", resource: "membership", logContext: { organizationId } },
        (args) => updateV3OrganizationMemberRole({ organizationId, userId, body, ...args }),
        ZV3MemberRoleUpdateResource,
        summarizeRoleUpdate
      )
  );

  registerScopedTool(
    server,
    "remove_member",
    {
      title: "Remove member",
      description:
        "Remove a member from an organization, with their team memberships. Nothing is removed unless confirm is true: without it you only get a preview, so show it and set confirm only after the person approves. Needs an organization owner or manager (signed in, not an API key). You cannot remove yourself (leaving is the person's own action in the app); a manager cannot remove an owner; the last owner cannot be removed.",
      inputSchema: ZMcpRemoveMemberInput,
      outputSchema: ZMcpMemberRemoveOutput,
      audit: { action: "deleted", targetType: "membership", targetIdArg: "userId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    MEMBER_WRITE_SCOPES,
    ({ organizationId, userId, confirm }: TMcpRemoveMemberInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "deleted", resource: "membership", logContext: { organizationId } },
        (args) => removeV3OrganizationMember({ organizationId, userId, confirm, ...args }),
        ZV3MemberRemoveResource,
        summarizeRemoval
      )
  );
}
