import "server-only";

import { unstable_cache } from "next/cache";

import { ZId } from "@formbricks/types/environment";

import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { getMembershipByUserIdTeamId } from "../membership/service";
import { getAccessFlags } from "../membership/utils";
import { teamCache } from "../team/cache";
import { validateInputs } from "../utils/validate";
import { getTeamsByUserId } from "./service";

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
    [`canUserAccessTeam-${userId}-${teamId}`],
    { revalidate: SERVICES_REVALIDATION_INTERVAL, tags: [teamCache.tag.byId(teamId)] }
  )();

export const verifyUserRoleAccess = async (
  teamId: string,
  userId: string
): Promise<{
  hasCreateOrUpdateAccess: boolean;
  hasDeleteAccess: boolean;
  hasCreateOrUpdateMembersAccess: boolean;
  hasDeleteMembersAccess: boolean;
  hasBillingAccess: boolean;
}> => {
  const accessObject = {
    hasCreateOrUpdateAccess: true,
    hasDeleteAccess: true,
    hasCreateOrUpdateMembersAccess: true,
    hasDeleteMembersAccess: true,
    hasBillingAccess: true,
  };

  const currentUserMembership = await getMembershipByUserIdTeamId(userId, teamId);
  const { isOwner, isAdmin } = getAccessFlags(currentUserMembership?.role);

  if (!isOwner) {
    accessObject.hasCreateOrUpdateAccess = false;
    accessObject.hasDeleteAccess = false;
    accessObject.hasCreateOrUpdateMembersAccess = false;
    accessObject.hasDeleteMembersAccess = false;
    accessObject.hasBillingAccess = false;
  }

  if (isAdmin) {
    accessObject.hasCreateOrUpdateMembersAccess = true;
    accessObject.hasDeleteMembersAccess = true;
    accessObject.hasBillingAccess = true;
  }

  return accessObject;
};
