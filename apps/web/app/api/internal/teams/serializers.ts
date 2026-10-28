import type { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";

/** A team as a picker lists it: its id and name, nothing about its members or workspaces. */
export type TTeamOptionResource = { id: string; name: string };

export const serializeTeamOption = (team: TOrganizationTeam): TTeamOptionResource => ({
  id: team.id,
  name: team.name,
});
