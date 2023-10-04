import "server-only";

import { prisma } from "@formbricks/database";
import { TTagsCount } from "@formbricks/types/v1/tags";
import { cache } from "react";

export const getTagOnResponseCacheTag = (tagId: string, responseId: string) =>
  `tagsOnResponse-${tagId}-${responseId}`;

export const addTagToRespone = async (responseId: string, tagId: string) => {
  try {
    const tagOnResponse = await prisma.tagsOnResponses.create({
      data: {
        responseId,
        tagId,
      },
    });
    return tagOnResponse;
  } catch (error) {
    throw error;
  }
};

export const deleteTagOnResponse = async (responseId: string, tagId: string) => {
  try {
    const deletedTag = await prisma.tagsOnResponses.delete({
      where: {
        responseId_tagId: {
          responseId,
          tagId,
        },
      },
    });
    return deletedTag;
  } catch (error) {
    throw error;
  }
};

export const getTagsOnResponsesCount = cache(async (): Promise<TTagsCount> => {
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
});
