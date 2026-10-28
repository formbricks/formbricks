import type { TTeamDetails, TTeamRole } from "@/modules/ee/teams/team-list/types/team";

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
