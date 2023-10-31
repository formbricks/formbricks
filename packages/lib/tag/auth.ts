import "server-only";

import { validateInputs } from "../utils/validate";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getTag } from "./service";
import { unstable_cache } from "next/cache";
import { ZId } from "@formbricks/types/environment";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { getMembershipByUserIdTeamId } from "../../lib/membership/service";
import { getAccessFlags } from "../../lib/membership/utils";
import { getTeamByEnvironmentId } from "../../lib/team/service";

export const canUserAccessTag = async (userId: string, tagId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [tagId, ZId]);

      const tag = await getTag(tagId);
      if (!tag) return false;

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, tag.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },
    [`${userId}-${tagId}`],
    {
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const verifyUserRoleAccess = async (
  environmentId: string,
  userId: string
): Promise<{
  hasCreateOrUpdateAccess: boolean;
  hasDeleteAccess: boolean;
}> =>
  await unstable_cache(
    async () => {
      const team = await getTeamByEnvironmentId(environmentId);
      if (!team) {
        throw new Error("Team not found");
      }
      const currentUserMembership = await getMembershipByUserIdTeamId(userId, team.id);
      const { isViewer } = getAccessFlags(currentUserMembership?.role);

      if (isViewer) {
        return {
          hasCreateOrUpdateAccess: false,
          hasDeleteAccess: false,
        };
      }

      return {
        hasCreateOrUpdateAccess: true,
        hasDeleteAccess: true,
      };
    },
    [`users-${userId}-verifyUserRoleAccessOnTag-${new Date().getTime()}`],
    {
      revalidate: 60 * 60 * 24,
    }
  )();
