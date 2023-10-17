import "server-only";

import { prisma } from "@formbricks/database";
import { TTag } from "@formbricks/types/v1/tags";
import { ITEMS_PER_PAGE } from "../constants";
import { ZOptionalNumber, ZString } from "@formbricks/types/v1/common";
import { validateInputs } from "../utils/validate";
import { ZId } from "@formbricks/types/v1/environment";

export const getTagsByEnvironmentId = async (environmentId: string, page?: number): Promise<TTag[]> => {
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
};

export const getTag = async (tagId: string): Promise<TTag | null> => {
  validateInputs([tagId, ZId]);

  try {
    const tag = await prisma.tag.findUnique({
      where: {
        id: tagId,
      },
    });

    return tag;
  } catch (error) {
    throw error;
  }
};

export const createTag = async (environmentId: string, name: string): Promise<TTag> => {
  validateInputs([environmentId, ZId], [name, ZString]);

  try {
    const tag = await prisma.tag.create({
      data: {
        name,
        environmentId,
      },
    });

    return tag;
  } catch (error) {
    throw error;
  }
};

export const deleteTag = async (tagId: string): Promise<TTag> => {
  validateInputs([tagId, ZId]);

  try {
    const tag = await prisma.tag.delete({
      where: {
        id: tagId,
      },
    });

    return tag;
  } catch (error) {
    throw error;
  }
};

export const updateTagName = async (tagId: string, name: string): Promise<TTag> => {
  validateInputs([tagId, ZId], [name, ZString]);

  try {
    const tag = await prisma.tag.update({
      where: {
        id: tagId,
      },
      data: {
        name,
      },
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

    return newTag;
  } catch (error) {
    throw error;
  }
};
