import { hasUserEnvironmentAccess } from "../environment/auth";
import { getTag } from "./service";
import { unstable_cache } from "next/cache";

export const canUserAccessTag = async (userId: string, tagId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      if (!userId) return false;

      const tag = await getTag(tagId);
      if (!tag) return false;

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, tag.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },
    [`${userId}-${tagId}`],
    {
      revalidate: 30 * 60, // 30 minutes
    }
  )();
