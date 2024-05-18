import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@formbricks/database";
import { ZOptionalNumber } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TGoogleTag, TGoogleTagInput, ZGoogleTagInput } from "@formbricks/types/google-tags";

import { cache } from "../cache";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";
import { googleTagCache } from "./cache";

export const getGoogleTags = (environmentId: string, page?: number): Promise<TGoogleTag[]> =>
  cache(
    async () => {
      validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

      try {
        const googleTags = await prisma.googleTag.findMany({
          where: {
            environmentId: environmentId,
          },
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        });
        return googleTags;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getGoogleTags-${environmentId}-${page}`],
    {
      tags: [googleTagCache.tag.byEnvironmentId(environmentId)],
    }
  )();

export const getGooglesTagsBySurveyId = (environmentId: string, surveyId: string): Promise<TGoogleTag[]> =>
  cache(
    async () => {
      validateInputs([environmentId, ZId], [surveyId, ZId]);
      try {
        const tags = await prisma.googleTag.findMany({
          where: {
            environmentId: {
              equals: environmentId,
            },
            OR: [
              {
                surveyIds: {
                  has: surveyId,
                },
              },
              {
                surveyIds: {
                  isEmpty: true,
                },
              },
            ],
          },
        });
        return tags;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getGoogleTagCountBySurveyId-${environmentId}-${surveyId}`],
    {
      tags: [googleTagCache.tag.byEnvironmentIdAndSurveyId(environmentId, surveyId)],
    }
  )();

export const getGoogleTagCountBySource = (environmentId: string): Promise<number> =>
  cache(
    async () => {
      validateInputs([environmentId, ZId]);

      try {
        const count = await prisma.googleTag.count({
          where: {
            environmentId,
          },
        });
        return count;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getWebhookCountBySource-${environmentId}`],
    {
      tags: [googleTagCache.tag.byEnvironmentId(environmentId)],
    }
  )();

export const getGoogleTag = async (id: string): Promise<TGoogleTag | null> =>
  cache(
    async () => {
      validateInputs([id, ZId]);

      try {
        const googleTag = await prisma.googleTag.findUnique({
          where: {
            id,
          },
        });
        return googleTag;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getGoogleTag-${id}`],
    {
      tags: [googleTagCache.tag.byId(id)],
    }
  )();

export const createGoogleTag = async (
  environmentId: string,
  googleTagInput: TGoogleTagInput
): Promise<TGoogleTag> => {
  validateInputs([environmentId, ZId], [googleTagInput, ZGoogleTagInput]);

  try {
    const createdGoogleTag = await prisma.googleTag.create({
      data: {
        ...googleTagInput,
        surveyIds: googleTagInput.surveyIds || [],
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
    });

    googleTagCache.revalidate({
      id: createdGoogleTag.id,
      environmentId: createdGoogleTag.environmentId,
      gtmId: createdGoogleTag.gtmId,
    });

    return createdGoogleTag;
  } catch (error) {
    if (!(error instanceof InvalidInputError)) {
      throw new DatabaseError(`Database error when creating google tag for environment ${environmentId}`);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const updateGoogleTag = async (
  environmentId: string,
  id: string,
  googleTagInput: Partial<TGoogleTagInput>
): Promise<TGoogleTag> => {
  validateInputs([environmentId, ZId], [id, ZId], [googleTagInput, ZGoogleTagInput]);
  try {
    const updatedGoogleTag = await prisma.googleTag.update({
      where: {
        id: id,
      },
      data: {
        name: googleTagInput.name,
        gtmId: googleTagInput.gtmId,
        surveyIds: googleTagInput.surveyIds || [],
      },
    });

    googleTagCache.revalidate({
      id: updatedGoogleTag.id,
      environmentId: updatedGoogleTag.environmentId,
      gtmId: updatedGoogleTag.gtmId,
    });

    return updatedGoogleTag;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deleteGoogletag = async (id: string): Promise<TGoogleTag> => {
  validateInputs([id, ZId]);

  try {
    let deletedGoogleTag = await prisma.googleTag.delete({
      where: {
        id,
      },
    });

    googleTagCache.revalidate({
      id: deletedGoogleTag.id,
      environmentId: deletedGoogleTag.environmentId,
      gtmId: deletedGoogleTag.gtmId,
    });

    return deletedGoogleTag;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ResourceNotFoundError("Google Tag", id);
    }
    throw new DatabaseError(`Database error when deleting google tag with ID ${id}`);
  }
};
