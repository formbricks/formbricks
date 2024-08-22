import "server-only";
import { ZId } from "@formbricks/types/common";
import { cache } from "../cache";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { personCache } from "./cache";
import { getPerson } from "./service";

export const canUserAccessPerson = (userId: string, personId: string): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([userId, ZId], [personId, ZId]);
      if (!userId) return false;

      try {
        const person = await getPerson(personId);
        if (!person) return false;

        const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, person.environmentId);
        if (!hasAccessToEnvironment) return false;

        return true;
      } catch (error) {
        throw error;
      }
    },
    [`canUserAccessPerson-${userId}-people-${personId}`],
    {
      tags: [personCache.tag.byId(personId)],
    }
  )();
