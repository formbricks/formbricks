import { hasUserEnvironmentAccessCached } from "../environment/auth";
import { getActionClass } from "./service";
import { unstable_cache } from "next/cache";

export const canUserAccessActionClass = async (userId: string, actionClassId: string): Promise<boolean> => {
  if (!userId) return false;

  const actionClass = await getActionClass(actionClassId);
  if (!actionClass) return false;

  const hasAccessToEnvironment = await hasUserEnvironmentAccessCached(userId, actionClass.environmentId);
  if (!hasAccessToEnvironment) return false;

  return true;
};

export const canUserAccessActionClassCached = async (userId: string, actionClassId: string) =>
  await unstable_cache(
    async () => {
      return await canUserAccessActionClass(userId, actionClassId);
    },
    [`${userId}-${actionClassId}`],
    {
      revalidate: 30 * 60, // 30 minutes
    }
  )();
