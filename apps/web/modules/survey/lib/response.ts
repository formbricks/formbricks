import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/generated/client";
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
