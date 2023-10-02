import { hasUserEnvironmentAccess } from "../environment/auth";
import { getActionClass } from "./service";
import { unstable_cache } from "next/cache";

export const canUserAccessActionClass = async (userId: string, actionClassId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      if (!userId) return false;

      const actionClass = await getActionClass(actionClassId);
      if (!actionClass) return false;

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, actionClass.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },

    [`users-${userId}-actionClasses-${actionClassId}`],
    { revalidate: 30 * 60, tags: [`actionClasses-${actionClassId}`] }
  )(); // 30 minutes
