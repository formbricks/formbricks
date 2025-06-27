import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";

export const getResponseCountBySurveyId = reactCache(async (surveyId: string): Promise<number> => {
  try {
    const responseCount = await prisma.response.count({
      where: {
        surveyId,
      },
    });
    return responseCount;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const getSurveyResponseCountByEmail = reactCache(
  async (surveyId: string, email: string): Promise<number> => {
    try {
      const responseCount = await prisma.response.count({
        where: {
          surveyId,
          email,
        },
      });
      return responseCount;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
