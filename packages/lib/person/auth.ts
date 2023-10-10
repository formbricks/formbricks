import "server-only";

import { ZId } from "@formbricks/types/v1/environment";
import { validateInputs } from "../utils/validate";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getPersonCached } from "./service";
import { unstable_cache } from "next/cache";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";

export const canUserAccessPerson = async (userId: string, personId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [personId, ZId]);
      if (!userId) return false;

      const person = await getPersonCached(personId);
      if (!person) return false;

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, person.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },

    [`users-${userId}-persons-${personId}`],
    { revalidate: SERVICES_REVALIDATION_INTERVAL, tags: [`persons-${personId}`] }
  )();
