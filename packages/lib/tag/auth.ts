import "server-only";
import { ZId } from "@formbricks/types/common";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { getTag } from "./service";

export const canUserAccessTag = async (userId: string, tagId: string): Promise<boolean> => {
  validateInputs([userId, ZId], [tagId, ZId]);

  try {
    const tag = await getTag(tagId);
    if (!tag) return false;

    const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, tag.environmentId);
    if (!hasAccessToEnvironment) return false;

    return true;
  } catch (error) {
    throw error;
  }
};
