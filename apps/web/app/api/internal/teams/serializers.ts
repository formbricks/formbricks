import type { TOrganizationTeam, TTeamDetails, TTeamRole } from "@/modules/ee/teams/team-list/types/team";

/** A team as the team settings modal shows it: its members and its workspace grants. */
export type TTeamResource = TTeamDetails;

/** A team read for the settings modal, with the caller's own role in it (`null` when not a member). */
export type TTeamWithCurrentUserRoleResource = TTeamResource & { currentUserRole: TTeamRole | null };

/** Field by field, so a column added to the service's result never reaches the response by accident. */
export const serializeTeam = (team: TTeamDetails): TTeamResource => ({
  id: team.id,
  name: team.name,
  organizationId: team.organizationId,
  members: team.members.map(({ userId, name, role }) => ({ userId, name, role })),
  workspaces: team.workspaces.map(({ workspaceId, workspaceName, permission }) => ({
    workspaceId,
    workspaceName,
    permission,
  })),
});

/** A team as a picker lists it: its id and name, nothing about its members or workspaces. */
export type TTeamOptionResource = { id: string; name: string };

export const serializeTeamOption = (team: TOrganizationTeam): TTeamOptionResource => ({
  id: team.id,
  name: team.name,
});
