import "server-only";

import { validateInputs } from "../utils/validate";
import { unstable_cache } from "next/cache";
import { ZId } from "@formbricks/types/v1/environment";
import { canUserAccessResponse } from "../response/auth";
import { canUserAccessTag } from "../tag/auth";
import { getTagOnResponseCacheTag } from "../services/tagOnResponse";

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
    { revalidate: 30 * 60, tags: [getTagOnResponseCacheTag(tagId, responseId)] }
  )();
