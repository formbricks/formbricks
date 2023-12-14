import "server-only";

import { SERVICES_REVALIDATION_INTERVAL } from "@/constants";
import { responseCache } from "@/response/cache";
import { validateInputs } from "@/utils/validate";
import { unstable_cache } from "next/cache";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/environment";
import { TTagsCount, TTagsOnResponses } from "@formbricks/types/tags";

import { tagOnResponseCache } from "./cache";

const selectTagsOnResponse = {
  tag: {
    select: {
      environmentId: true,
    },
  },
};

export const addTagToRespone = async (responseId: string, tagId: string): Promise<TTagsOnResponses> => {
  try {
    const tagOnResponse = await prisma.tagsOnResponses.create({
      data: {
        responseId,
        tagId,
      },
      select: selectTagsOnResponse,
    });

    responseCache.revalidate({
      id: responseId,
    });

    tagOnResponseCache.revalidate({
      tagId,
      responseId,
      environmentId: tagOnResponse.tag.environmentId,
    });

    return {
      responseId,
      tagId,
    };
  } catch (error) {
    throw error;
  }
};

export const deleteTagOnResponse = async (responseId: string, tagId: string): Promise<TTagsOnResponses> => {
  try {
    const deletedTag = await prisma.tagsOnResponses.delete({
      where: {
        responseId_tagId: {
          responseId,
          tagId,
        },
      },
      select: selectTagsOnResponse,
    });

    responseCache.revalidate({
      id: responseId,
    });

    tagOnResponseCache.revalidate({
      tagId,
      responseId,
      environmentId: deletedTag.tag.environmentId,
    });

    return {
      tagId,
      responseId,
    };
  } catch (error) {
    throw error;
  }
};

export const getTagsOnResponsesCount = async (environmentId: string): Promise<TTagsCount> =>
  unstable_cache(
    async () => {
      validateInputs([environmentId, ZId]);

      try {
        const tagsCount = await prisma.tagsOnResponses.groupBy({
          by: ["tagId"],
          where: {
            response: {
              survey: {
                environment: {
                  id: environmentId,
                },
              },
            },
          },
          _count: {
            _all: true,
          },
        });

        return tagsCount.map((tagCount) => ({ tagId: tagCount.tagId, count: tagCount._count._all }));
      } catch (error) {
        throw error;
      }
    },
    [`getTagsOnResponsesCount-${environmentId}`],
    {
      tags: [tagOnResponseCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
