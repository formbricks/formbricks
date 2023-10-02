import { hasUserEnvironmentAccessCached } from "../environment/auth";
import { getTag } from "./service";

export const canUserAccessTag = async (userId: string, tagId: string): Promise<boolean> => {
  if (!userId) return false;

  const tag = await getTag(tagId);
  if (!tag) return false;

  const hasAccessToEnvironment = await hasUserEnvironmentAccessCached(userId, tag.environmentId);
  if (!hasAccessToEnvironment) return false;

  return true;
};
