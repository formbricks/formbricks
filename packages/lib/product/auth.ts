import { unstable_cache } from "next/cache";

import { ZId } from "@formbricks/types/environment";

import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { getMembershipByUserIdTeamId } from "../membership/service";
import { getAccessFlags } from "../membership/utils";
import { getTeamsByUserId } from "../team/service";
import { validateInputs } from "../utils/validate";
import { productCache } from "./cache";
import { getProduct } from "./service";

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
}> => {
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
};
