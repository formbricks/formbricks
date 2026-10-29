import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  createV3Team,
  deleteV3Team,
  getV3Team,
  listV3Teams,
  updateV3Team,
} from "@/app/api/v3/teams/lib/operations";
import {
  ZV3TeamDeleteResource,
  ZV3TeamListItem,
  ZV3TeamResource,
  ZV3TeamUpdateResource,
} from "@/app/api/v3/teams/lib/schemas";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import { plural, withIdSummary } from "./id-summary";
import { runIdSummaryMutation } from "./id-summary-mutation";
import { mcpToolOutput } from "./output-schemas";
import {
  type TMcpCreateTeamInput,
  type TMcpDeleteTeamInput,
  type TMcpListTeamsInput,
  type TMcpUpdateTeamInput,
  ZMcpCreateTeamInput,
  ZMcpDeleteTeamInput,
  ZMcpListTeamsInput,
  ZMcpUpdateTeamInput,
} from "./teams-schemas";

const TEAM_READ_SCOPES: [string, ...string[]] = ["teams:read"];
const TEAM_WRITE_SCOPES: [string, ...string[]] = ["teams:write"];

const ZV3TeamList = z.array(ZV3TeamListItem);
const ZMcpTeamsOutput = mcpToolOutput(z.union([ZV3TeamList, ZV3TeamResource]));
const ZMcpTeamOutput = mcpToolOutput(ZV3TeamResource);
const ZMcpUpdateTeamOutput = mcpToolOutput(ZV3TeamUpdateResource);
const ZMcpDeleteTeamOutput = mcpToolOutput(ZV3TeamDeleteResource);

/**
 * What the model reads after `list_teams`: ids and counts, never a team or person's name. Names, roles and
 * workspace access are in `structuredContent`, because team names are written by other people (ADR 0017).
 */
export const summarizeTeams = (
  data: z.infer<typeof ZV3TeamList> | z.infer<typeof ZV3TeamResource>
): string => {
  if (Array.isArray(data)) {
    const ids = data.map((team) => team.id).join(", ");
    return `${plural(data.length, "team")}${ids ? `: ${ids}` : ""}. Names, member counts and workspace access are in structuredContent.`;
  }

  return `Team ${data.id} with ${plural(data.members.length, "member")} and workspace access to ${plural(data.workspaces.length, "workspace")}. Names and roles are in structuredContent.`;
};

export const summarizeTeamUpdate = (update: z.infer<typeof ZV3TeamUpdateResource>): string => {
  const { changes } = update;
  const counts = [
    `${changes.membersAdded.length} members added`,
    `${changes.membersRemoved.length} removed`,
    `${changes.memberRolesChanged.length} roles changed`,
    `${changes.workspacesAdded.length} workspaces added`,
    `${changes.workspacesRemoved.length} removed`,
    `${changes.workspacePermissionsChanged.length} permissions changed`,
  ].join(", ");
  const renamed = changes.name ? "renamed, " : "";

  if (update.status === "preview") {
    return `Not changed: a preview of an update to team ${update.team.id} that takes access away (${renamed}${counts}). Call again with confirm true after the person approves.`;
  }
  if (update.status === "unchanged") {
    return `Team ${update.team.id} already matches this request; nothing was written.`;
  }

  return `Team ${update.team.id} updated (${renamed}${counts}).`;
};

export const summarizeTeamDelete = (result: z.infer<typeof ZV3TeamDeleteResource>): string =>
  result.status === "preview"
    ? `Not deleted: a preview of deleting team ${result.id}, which has ${plural(result.memberCount, "member")} and ${plural(result.workspaceCount, "workspace grant")}. Call again with confirm true after the person approves.`
    : `Team ${result.id} deleted.`;

export function registerTeamTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_teams",
    {
      title: "List teams",
      description:
        "List an organization's teams with their member counts and the caller's own role in each; organization owners and managers also see which workspaces each team can use. Pass teamId to read one team in full, with its members and workspace access, before changing it with update_team. Teams are an Enterprise feature: without the licence this answers a 403 that says so, never an empty list. Needs a signed-in person (not an API key).",
      inputSchema: ZMcpListTeamsInput,
      outputSchema: ZMcpTeamsOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    TEAM_READ_SCOPES,
    async ({ organizationId, teamId }: TMcpListTeamsInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const authentication = getMcpAuthentication(authInfo);
      const response = teamId
        ? await getV3Team({ teamId, authentication, requestId, instance: MCP_API_ROUTE })
        : await listV3Teams({ organizationId, authentication, requestId, instance: MCP_API_ROUTE });

      return withIdSummary(
        await responseToMcpToolResult(response, requestId),
        z.union([ZV3TeamList, ZV3TeamResource]),
        summarizeTeams
      );
    }
  );

  registerScopedTool(
    server,
    "create_team",
    {
      title: "Create team",
      description:
        "Create an empty team in an organization. It has no members and no workspace access yet: add them with update_team. Needs an organization owner or manager (as a signed-in person, not an API key) and the Enterprise licence. A name already used in the organization is a 409.",
      inputSchema: ZMcpCreateTeamInput,
      outputSchema: ZMcpTeamOutput,
      audit: { action: "created", targetType: "team" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    TEAM_WRITE_SCOPES,
    ({ organizationId, ...body }: TMcpCreateTeamInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "created", resource: "team", logContext: { organizationId } },
        (args) => createV3Team({ organizationId, body, ...args }),
        ZV3TeamResource,
        (team) => `Team ${team.id} created in organization ${team.organizationId}.`
      )
  );

  registerScopedTool(
    server,
    "update_team",
    {
      title: "Update team",
      description:
        "Change a team's name, members and workspace access. members and workspaces are the COMPLETE new lists (start from list_teams with teamId): anyone or any workspace left out is removed. A change that takes access away (removing a member, demoting an admin, removing a workspace or lowering its permission) changes nothing unless confirm is true: without it you get a preview, so show it to the person and set confirm only after they approve. Adding people and widening access applies at once. Organization owners and managers may change everything; a team's own admins only the name and members, and not their own membership. Owners and managers are always team admins. Needs the Enterprise licence and a signed-in person (not an API key).",
      inputSchema: ZMcpUpdateTeamInput,
      outputSchema: ZMcpUpdateTeamOutput,
      audit: { action: "updated", targetType: "team", targetIdArg: "teamId" },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    TEAM_WRITE_SCOPES,
    ({ teamId, ...body }: TMcpUpdateTeamInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "updated", resource: "team", logContext: { teamId } },
        (args) => updateV3Team({ teamId, body, ...args }),
        ZV3TeamUpdateResource,
        summarizeTeamUpdate
      )
  );

  registerScopedTool(
    server,
    "delete_team",
    {
      title: "Delete team",
      description:
        "Delete a team. Its members stay in the organization but lose the workspace access the team gave them. Nothing is deleted unless confirm is true: without it you only get a preview with the member and workspace counts, so show that to the person and set confirm only after they approve. Needs an organization owner or manager (as a signed-in person, not an API key) and the Enterprise licence.",
      inputSchema: ZMcpDeleteTeamInput,
      outputSchema: ZMcpDeleteTeamOutput,
      audit: { action: "deleted", targetType: "team", targetIdArg: "teamId" },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    TEAM_WRITE_SCOPES,
    ({ teamId, confirm }: TMcpDeleteTeamInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "deleted", resource: "team", logContext: { teamId } },
        (args) => deleteV3Team({ teamId, confirm, ...args }),
        ZV3TeamDeleteResource,
        summarizeTeamDelete
      )
  );
}
