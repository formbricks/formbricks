import "server-only";

import { prisma } from "@formbricks/database";
import { TTagsCount, TTagsOnResponses } from "@formbricks/types/tags";
import { responseCache } from "../response/cache";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { unstable_cache } from "next/cache";
import { tagOnResponseCache } from "./cache";

export const addTagToRespone = async (responseId: string, tagId: string): Promise<TTagsOnResponses> => {
  try {
    const tagOnResponse = await prisma.tagsOnResponses.create({
      data: {
        responseId,
        tagId,
      },
    });

    responseCache.revalidate({
      responseId,
    });

    tagOnResponseCache.revalidate({
      id: tagId,
      responseId,
      functionName: "getTagsOnResponsesCount",
    });

    return tagOnResponse;
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
    });

    responseCache.revalidate({
      responseId,
    });

    tagOnResponseCache.revalidate({
      id: tagId,
      responseId,
      functionName: "getTagsOnResponsesCount",
    });

    return deletedTag;
  } catch (error) {
    throw error;
  }
};

export const getTagsOnResponsesCount = async (): Promise<TTagsCount> =>
  unstable_cache(
    async () => {
      try {
        const tagsCount = await prisma.tagsOnResponses.groupBy({
          by: ["tagId"],
          _count: {
            _all: true,
          },
        });

        return tagsCount.map((tagCount) => ({ tagId: tagCount.tagId, count: tagCount._count._all }));
      } catch (error) {
        throw error;
      }
    },
    [`getTagsOnResponsesCount`],
    {
      tags: [tagOnResponseCache.tag.byFunctionName("getTagsOnResponsesCount")],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
