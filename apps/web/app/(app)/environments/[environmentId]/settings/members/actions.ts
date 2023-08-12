"use server";

import { updateTeam } from "@formbricks/lib/services/team";
import { TTeamUpdateInput } from "@formbricks/types/v1/teams";

export const updateTeamAction = async (teamId: string, data: TTeamUpdateInput) => {
  return await updateTeam(teamId, data);
};
