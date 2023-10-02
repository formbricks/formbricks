import { hasUserEnvironmentAccessCached } from "../environment/auth";
import { getTag } from "./service";
import { unstable_cache } from "next/cache";

export const canUserAccessTag = async (userId: string, tagId: string): Promise<boolean> => {
  if (!userId) return false;

  const tag = await getTag(tagId);
  if (!tag) return false;

  const hasAccessToEnvironment = await hasUserEnvironmentAccessCached(userId, tag.environmentId);
  if (!hasAccessToEnvironment) return false;

  return true;
};

export const canUserAccessTagCached = async (userId: string, tagId: string) =>
  await unstable_cache(
    async () => {
      return await canUserAccessTag(userId, tagId);
    },
    [`${userId}-${tagId}`],
    {
      revalidate: 30 * 60, // 30 minutes
    }
  )();
