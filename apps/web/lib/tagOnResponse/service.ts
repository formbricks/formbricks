import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TTagsCount, TTagsOnResponses } from "@formbricks/types/tags";
import { andVisibleSurveys } from "@/lib/survey/visibility/predicate";
import { getUniqueConstraintFields, isUniqueConstraintError } from "../utils/prisma-constraint";
import { validateInputs } from "../utils/validate";

const selectTagsOnResponse = {
  tag: {
    select: {
      workspaceId: true,
    },
  },
};

export const addTagToRespone = async (responseId: string, tagId: string): Promise<TTagsOnResponses> => {
  try {
    await prisma.tagsOnResponses.create({
      data: {
        responseId,
        tagId,
      },
      select: selectTagsOnResponse,
    });

    return {
      responseId,
      tagId,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const fields = getUniqueConstraintFields(error);
      if (fields.includes("responseId") && fields.includes("tagId")) {
        // Idempotent: the tag is already on the response.
        return {
          responseId,
          tagId,
        };
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deleteTagOnResponse = async (responseId: string, tagId: string): Promise<TTagsOnResponses> => {
  try {
    await prisma.tagsOnResponses.delete({
      where: {
        responseId_tagId: {
          responseId,
          tagId,
        },
      },
      select: selectTagsOnResponse,
    });

    return {
      tagId,
      responseId,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getTagsOnResponsesCount = reactCache(
  async (
    workspaceId: string,
    /** ENG-3282: the caller's survey-visibility clause, so a restricted survey's responses are not counted. */
    visibleSurveyWhere: Prisma.SurveyWhereInput
  ): Promise<TTagsCount> => {
    validateInputs([workspaceId, ZId]);

    try {
      const tagsCount = await prisma.tagsOnResponses.groupBy({
        by: ["tagId"],
        where: {
          response: {
            survey: {
              workspaceId,
              ...andVisibleSurveys(visibleSurveyWhere),
            },
          },
        },
        _count: {
          _all: true,
        },
      });

      return tagsCount.map((tagCount) => ({ tagId: tagCount.tagId, count: tagCount._count._all }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
