import "server-only";

import { ZId } from "@formbricks/types/environment";
import { validateInputs } from "../utils/validate";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getAttributeClass } from "./service";
import { unstable_cache } from "next/cache";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";

export const canUserAccessAttributeClass = async (
  userId: string,
  attributeClassId: string
): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [attributeClassId, ZId]);
      if (!userId) return false;

      const attributeClass = await getAttributeClass(attributeClassId);
      if (!attributeClass) return false;

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, attributeClass.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },

    [`users-${userId}-attributeClasses-${attributeClassId}`],
    { revalidate: SERVICES_REVALIDATION_INTERVAL, tags: [`attributeClasses-${attributeClassId}`] }
  )();
