import { ZId } from "@formbricks/types/v1/environment";
import { validateInputs } from "../utils/validate";
import { getProduct, getProductCacheTag } from "./service";
import { unstable_cache } from "next/cache";
import { getTeamsByUserId } from "../team/service";

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
    [`users-${userId}-products-${productId}`],
    { revalidate: 30 * 60, tags: [getProductCacheTag(productId)] }
  )(); // 30 minutes
