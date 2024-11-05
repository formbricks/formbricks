import "server-only";
import { ZId } from "@formbricks/types/common";
import { cache } from "../cache";
import { canUserAccessResponse } from "../response/auth";
import { canUserAccessTag } from "../tag/auth";
import { validateInputs } from "../utils/validate";
import { tagOnResponseCache } from "./cache";

export const canUserAccessTagOnResponse = (
  userId: string,
  tagId: string,
  responseId: string
): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([userId, ZId], [tagId, ZId], [responseId, ZId]);

      try {
        const isAuthorizedForTag = await canUserAccessTag(userId, tagId);
        const isAuthorizedForResponse = await canUserAccessResponse(userId, responseId);

        return isAuthorizedForTag && isAuthorizedForResponse;
      } catch (error) {
        throw error;
      }
    },
    [`canUserAccessTagOnResponse-${userId}-${tagId}-${responseId}`],
    {
      tags: [tagOnResponseCache.tag.byResponseIdAndTagId(responseId, tagId)],
    }
  )();
