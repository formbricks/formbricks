import { ZId } from "@formbricks/types/environment";
import { validateInputs } from "../utils/validate";
import { getProduct } from "./service";
import { unstable_cache } from "next/cache";
import { getTeamsByUserId } from "../team/service";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { productCache } from "./cache";
import { getMembershipByUserIdTeamId } from "../../lib/membership/service";
import { getAccessFlags } from "../../lib/membership/utils";
import { getTeamByEnvironmentId } from "../../lib/team/service";

export const canUserAccessProduct = async (userId: string, productId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [productId, ZId]);

      if (!userId || !productId) return false;

      const product = await getProduct(productId);
      if (!product) return false;

      const teamIds = (await getTeamsByUserId(userId)).map((team) => team.id);
      return teamIds.includes(product.teamId);
    },
    [`canUserAccessProduct-${userId}-${productId}`],
    {
      revalidate: SERVICES_REVALIDATION_INTERVAL,
      tags: [productCache.tag.byId(productId), productCache.tag.byUserId(userId)],
    }
  )();

export const verifyUserRoleAccess = async (
  teamId: string,
  userId: string
): Promise<{
  hasCreateOrUpdateAccess: boolean;
  hasDeleteAccess: boolean;
}> =>
  await unstable_cache(
    async () => {
      const accessObject = {
        hasCreateOrUpdateAccess: true,
        hasDeleteAccess: true,
      };

      if (!teamId) {
        throw new Error("Team not found");
      }

      const currentUserMembership = await getMembershipByUserIdTeamId(userId, teamId);
      const { isDeveloper, isViewer } = getAccessFlags(currentUserMembership?.role);

      if (isDeveloper || isViewer) {
        accessObject.hasCreateOrUpdateAccess = false;
        accessObject.hasDeleteAccess = false;
      }

      return accessObject;
    },
    [`users-${userId}-verifyUserRoleAccessOnProduct-${new Date().getTime()}`],
    {
      revalidate: 60 * 60 * 24,
    }
  )();
