import "server-only";

import { ZId } from "@formbricks/types/environment";
import { validateInputs } from "../utils/validate";
import { getTeamsByUserId } from "./service";
import { unstable_cache } from "next/cache";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";

export const canUserAccessTeam = async (userId: string, teamId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [teamId, ZId]);

      const userTeams = await getTeamsByUserId(userId);

      const givenTeamExists = userTeams.filter((team) => (team.id = teamId));
      if (!givenTeamExists) {
        return false;
      }
      return true;
    },

    [`users-${userId}-teams-${teamId}`],
    { revalidate: SERVICES_REVALIDATION_INTERVAL, tags: [`teams-${teamId}`] }
  )();
