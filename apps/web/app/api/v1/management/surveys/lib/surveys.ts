import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { selectSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";
import { andVisibleSurveys } from "@/lib/survey/visibility/predicate";
import { validateInputs } from "@/lib/utils/validate";

export const getSurveys = reactCache(
  async (
    workspaceIds: string[],
    limit?: number,
    offset?: number,
    /** ENG-3282: the API key's visibility clause; `{}` while survey visibility is not enforced. */
    visibleSurveyWhere: Prisma.SurveyWhereInput = {}
  ): Promise<TSurvey[]> => {
    validateInputs([workspaceIds, ZId.array()], [limit, ZOptionalNumber], [offset, ZOptionalNumber]);

    try {
      const surveysPrisma = await prisma.survey.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          ...andVisibleSurveys(visibleSurveyWhere),
        },
        select: selectSurvey,
        orderBy: {
          updatedAt: "desc",
        },
        take: limit,
        skip: offset,
      });
      return surveysPrisma.map((surveyPrisma) => transformPrismaSurvey<TSurvey>(surveyPrisma));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error getting surveys");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
