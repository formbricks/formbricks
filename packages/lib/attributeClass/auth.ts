import "server-only";
import { ZId } from "@formbricks/types/common";
import { cache } from "../cache";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { getAttributeClass } from "./service";

export const canUserAccessAttributeClass = async (
  userId: string,
  attributeClassId: string
): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([userId, ZId], [attributeClassId, ZId]);
      if (!userId) return false;

      try {
        const attributeClass = await getAttributeClass(attributeClassId);
        if (!attributeClass) return false;

        const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, attributeClass.environmentId);
        if (!hasAccessToEnvironment) return false;

        return true;
      } catch (error) {
        throw error;
      }
    },

    [`canUserAccessAttributeClass-${userId}-${attributeClassId}`],
    { tags: [`attributeClasses-${attributeClassId}`] }
  )();
