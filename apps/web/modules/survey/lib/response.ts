import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";

const countResponses = async (where: Prisma.ResponseWhereInput): Promise<number> => {
  try {
    return await prisma.response.count({ where });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

/** Counts every response row for the survey, including partial starts. */
export const getResponseCountBySurveyId = reactCache(
  async (surveyId: string): Promise<number> => countResponses({ surveyId })
);

/**
 * Counts completed responses only. The response limit ("Close survey on response limit") is
 * defined in terms of completed responses, so partial starts must never count towards it —
 * anything comparing against `survey.autoComplete` has to use this count.
 */
export const getFinishedResponseCountBySurveyId = reactCache(
  async (surveyId: string): Promise<number> => countResponses({ surveyId, finished: true })
);
