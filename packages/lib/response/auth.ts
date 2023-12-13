import { unstable_cache } from "next/cache";
import "server-only";

import { ZId } from "@formbricks/types/environment";

import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getSurvey } from "../survey/service";
import { validateInputs } from "../utils/validate";
import { responseCache } from "./cache";
import { getResponse } from "./service";

export const canUserAccessResponse = async (userId: string, responseId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [responseId, ZId]);

      if (!userId) return false;

      const response = await getResponse(responseId);
      if (!response) return false;

      const survey = await getSurvey(response.surveyId);
      if (!survey) return false;

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, survey.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },
    [`canUserAccessResponse-${userId}-${responseId}`],
    { revalidate: SERVICES_REVALIDATION_INTERVAL, tags: [responseCache.tag.byId(responseId)] }
  )();
