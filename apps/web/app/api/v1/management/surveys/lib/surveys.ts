import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { selectSurvey } from "@formbricks/lib/survey/service";
import { transformPrismaSurvey } from "@formbricks/lib/survey/utils";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { logger } from "@formbricks/logger";
import { ZOptionalNumber } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";

export const getSurveys = reactCache(
  async (environmentIds: string[], limit?: number, offset?: number): Promise<TSurvey[]> =>
    cache(
      async () => {
        validateInputs([environmentIds, ZId.array()], [limit, ZOptionalNumber], [offset, ZOptionalNumber]);

        try {
          const surveysPrisma = await prisma.survey.findMany({
            where: {
              environmentId: { in: environmentIds },
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
      },
      environmentIds.map((environmentId) => `getSurveys-management-api-${environmentId}-${limit}-${offset}`),
      {
        tags: environmentIds.map((environmentId) => surveyCache.tag.byEnvironmentId(environmentId)),
      }
    )()
);
