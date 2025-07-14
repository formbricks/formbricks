import "server-only";
import { TagError } from "@/modules/projects/settings/types/tag";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId, ZOptionalNumber, ZString } from "@formbricks/types/common";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TTag } from "@formbricks/types/tags";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";

export const getTagsByEnvironmentId = reactCache(
  async (environmentId: string, page?: number): Promise<TTag[]> => {
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
  }
);

export const getTag = reactCache(async (id: string): Promise<TTag | null> => {
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
});

export const createTag = async (
  environmentId: string,
  name: string
): Promise<Result<TTag, { code: TagError; message: string; meta?: Record<string, string> }>> => {
  validateInputs([environmentId, ZId], [name, ZString]);

  try {
    const tag = await prisma.tag.create({
      data: {
        name,
        environmentId,
      },
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
