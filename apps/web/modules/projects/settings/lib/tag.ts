import "server-only";
import { validateInputs } from "@/lib/utils/validate";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TTag } from "@formbricks/types/tags";

export const deleteTag = async (id: string): Promise<TTag> => {
  validateInputs([id, ZId]);

  try {
    const tag = await prisma.tag.delete({
      where: {
        id,
      },
    });

    return tag;
  } catch (error) {
    throw error;
  }
};

export const updateTagName = async (id: string, name: string): Promise<Result<TTag, ApiErrorResponseV2>> => {
  try {
    const tag = await prisma.tag.update({
      where: { id },
      data: { name },
    });

    return ok(tag);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        return err({
          type: "conflict",
          details: [{ field: "tag", issue: "Tag with this name already exists" }],
        });
      }
    }

    return err({
      type: "internal_server_error",
      details: [{ field: "tag", issue: error.message }],
    });
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
