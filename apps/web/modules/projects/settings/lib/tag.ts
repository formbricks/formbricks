import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TTag } from "@formbricks/types/tags";
import { validateInputs } from "@/lib/utils/validate";
import { TagError } from "@/modules/projects/settings/types/tag";

export const deleteTag = async (
  id: string
): Promise<Result<TTag, { code: TagError; message: string; meta?: Record<string, string> }>> => {
  validateInputs([id, ZId]);

  try {
    const tag = await prisma.tag.delete({
      where: {
        id,
      },
    });

    return ok(tag);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.RecordDoesNotExist) {
        return err({
          code: TagError.TAG_NOT_FOUND,
          message: "Tag not found",
        });
      }
    }

    return err({
      code: TagError.UNEXPECTED_ERROR,
      message: error.message,
    });
  }
};

export const updateTagName = async (
  id: string,
  name: string
): Promise<Result<TTag, { code: TagError; message: string; meta?: Record<string, string> }>> => {
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
          code: TagError.TAG_NAME_ALREADY_EXISTS,
          message: "Tag with this name already exists",
        });
      }
    }

    return err({
      code: TagError.UNEXPECTED_ERROR,
      message: error.message,
    });
  }
};

export const mergeTags = async (
  originalTagId: string,
  newTagId: string
): Promise<Result<TTag, { code: TagError; message: string; meta?: Record<string, string> }>> => {
  validateInputs([originalTagId, ZId], [newTagId, ZId]);

  try {
    let originalTag: TTag | null;

    originalTag = await prisma.tag.findUnique({
      where: {
        id: originalTagId,
      },
    });

    if (!originalTag) {
      return err({
        code: TagError.TAG_NOT_FOUND,
        message: "Tag not found",
      });
    }

    let newTag: TTag | null;

    newTag = await prisma.tag.findUnique({
      where: {
        id: newTagId,
      },
    });

    if (!newTag) {
      return err({
        code: TagError.TAG_NOT_FOUND,
        message: "Tag not found",
      });
    }

    // Find responses that have both tags to avoid unique constraint violations during merge
    const responsesWithBothTags = await prisma.response.findMany({
      where: {
        AND: [{ tags: { some: { tagId: originalTagId } } }, { tags: { some: { tagId: newTagId } } }],
      },
      select: { id: true },
    });

    const conflictResponseIds = responsesWithBothTags.map((r) => r.id);

    await prisma.$transaction([
      // Remove originalTag from responses that already have newTag (prevents unique constraint violation)
      ...(conflictResponseIds.length > 0
        ? [
            prisma.tagsOnResponses.deleteMany({
              where: {
                responseId: { in: conflictResponseIds },
                tagId: originalTagId,
              },
            }),
          ]
        : []),
      // Move all remaining originalTag associations to newTag
      prisma.tagsOnResponses.updateMany({
        where: { tagId: originalTagId },
        data: { tagId: newTagId },
      }),
      // Delete the original tag
      prisma.tag.delete({ where: { id: originalTagId } }),
    ]);

    return ok(newTag);
  } catch (error) {
    return err({
      code: TagError.UNEXPECTED_ERROR,
      message: error.message,
    });
  }
};
