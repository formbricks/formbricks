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
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";

export const getSurveys = reactCache(
  async (environmentId: string): Promise<TSurvey[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);

        try {
          const surveysPrisma = await prisma.survey.findMany({
            where: {
              environmentId,
              status: {
                not: "completed",
              },
            },
            select: selectSurvey,
            orderBy: {
              updatedAt: "desc",
            },
          });

          return surveysPrisma.map((surveyPrisma) => transformPrismaSurvey<TSurvey>(surveyPrisma));
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getSurveys-${environmentId}`],
      {
        tags: [surveyCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
