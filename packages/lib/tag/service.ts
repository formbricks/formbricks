import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { TTag } from "@formbricks/types/tags";
import { cache } from "../cache";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";
import { tagCache } from "./cache";

export const getTagsByEnvironmentId = reactCache(
  (environmentId: string, page?: number): Promise<TTag[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

        try {
          const tags = await prisma.tag.findMany({
            where: {
              environmentId,
            },
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          });

          return tags;
        } catch (error) {
          throw error;
        }
      },
      [`getTagsByEnvironmentId-${environmentId}-${page}`],
      {
        tags: [tagCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const getTag = reactCache(
  (id: string): Promise<TTag | null> =>
    cache(
      async () => {
        validateInputs([id, ZId]);

        try {
          const tag = await prisma.tag.findUnique({
            where: {
              id,
            },
          });

          return tag;
        } catch (error) {
          throw error;
        }
      },
      [`getTag-${id}`],
      {
        tags: [tagCache.tag.byId(id)],
      }
    )()
);

export const createTag = async (environmentId: string, name: string): Promise<TTag> => {
  validateInputs([environmentId, ZId], [name, ZString]);

  try {
    const tag = await prisma.tag.create({
      data: {
        name,
        environmentId,
      },
    });

    tagCache.revalidate({
      id: tag.id,
      environmentId,
    });

    return tag;
  } catch (error) {
    throw error;
  }
};

export const deleteTag = async (id: string): Promise<TTag> => {
  validateInputs([id, ZId]);

  try {
    const tag = await prisma.tag.delete({
      where: {
        id,
      },
    });

    tagCache.revalidate({
      id,
      environmentId: tag.environmentId,
    });

    return tag;
  } catch (error) {
    throw error;
  }
};

export const updateTagName = async (id: string, name: string): Promise<TTag> => {
  validateInputs([id, ZId], [name, ZString]);

  try {
    const tag = await prisma.tag.update({
      where: {
        id,
      },
      data: {
        name,
      },
    });

    tagCache.revalidate({
      id: tag.id,
      environmentId: tag.environmentId,
    });

    return tag;
  } catch (error) {
    throw error;
  }
};

export const mergeTags = async (originalTagId: string, newTagId: string): Promise<TTag | undefined> => {
  validateInputs([originalTagId, ZId], [newTagId, ZId]);

  try {
    let originalTag: TTag | null;

    originalTag = await prisma.tag.findUnique({
      where: {
        id: originalTagId,
      },
    });

    if (!originalTag) {
      throw new Error("Tag not found");
    }

    let newTag: TTag | null;

    newTag = await prisma.tag.findUnique({
      where: {
        id: newTagId,
      },
    });

    if (!newTag) {
      throw new Error("Tag not found");
    }

    // finds all the responses that have both the tags
    let responsesWithBothTags = await prisma.response.findMany({
      where: {
        AND: [
          {
            tags: {
              some: {
                tagId: {
                  in: [originalTagId],
                },
              },
            },
          },
          {
            tags: {
              some: {
                tagId: {
                  in: [newTagId],
                },
              },
            },
          },
        ],
      },
    });

    if (!!responsesWithBothTags?.length) {
      await Promise.all(
        responsesWithBothTags.map(async (response) => {
          await prisma.$transaction([
            prisma.tagsOnResponses.deleteMany({
              where: {
                responseId: response.id,
                tagId: {
                  in: [originalTagId, newTagId],
                },
              },
            }),

            prisma.tagsOnResponses.create({
              data: {
                responseId: response.id,
                tagId: newTagId,
              },
            }),
          ]);
        })
      );

      await prisma.$transaction([
        prisma.tagsOnResponses.updateMany({
          where: {
            tagId: originalTagId,
          },
          data: {
            tagId: newTagId,
          },
        }),

        prisma.tag.delete({
          where: {
            id: originalTagId,
          },
        }),
      ]);

      return newTag;
    }

    await prisma.$transaction([
      prisma.tagsOnResponses.updateMany({
        where: {
          tagId: originalTagId,
        },
        data: {
          tagId: newTagId,
        },
      }),

      prisma.tag.delete({
        where: {
          id: originalTagId,
        },
      }),
    ]);

    tagCache.revalidate({
      id: originalTagId,
      environmentId: originalTag.environmentId,
    });

    tagCache.revalidate({
      id: newTagId,
    });

    return newTag;
  } catch (error) {
    throw error;
  }
};
