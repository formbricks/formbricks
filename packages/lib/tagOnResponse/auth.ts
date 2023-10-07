import "server-only";

import { validateInputs } from "../utils/validate";
import { unstable_cache } from "next/cache";
import { ZId } from "@formbricks/types/v1/environment";
import { canUserAccessResponse } from "../response/auth";
import { canUserAccessTag } from "../tag/auth";
import { getTagOnResponseCacheTag } from "./service";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";

export const canUserAccessTagOnResponse = async (
  userId: string,
  tagId: string,
  responseId: string
): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [tagId, ZId], [responseId, ZId]);

      const isAuthorizedForTag = await canUserAccessTag(userId, tagId);
      const isAuthorizedForResponse = await canUserAccessResponse(userId, responseId);

      return isAuthorizedForTag && isAuthorizedForResponse;
    },
    [`users-${userId}-tagOnResponse-${tagId}-${responseId}`],
    { revalidate: SERVICES_REVALIDATION_INTERVAL, tags: [getTagOnResponseCacheTag(tagId, responseId)] }
  )();
