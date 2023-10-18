import "server-only";

import { prisma } from "@formbricks/database";
import { TTagsCount, TTagsOnResponses } from "@formbricks/types/v1/tags";
import { responseCache } from "../response/cache";

export const getTagOnResponseCacheTag = (tagId: string, responseId: string) =>
  `tagsOnResponse-${tagId}-${responseId}`;

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
    return deletedTag;
  } catch (error) {
    throw error;
  }
};

export const getTagsOnResponsesCount = async (): Promise<TTagsCount> => {
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
};
