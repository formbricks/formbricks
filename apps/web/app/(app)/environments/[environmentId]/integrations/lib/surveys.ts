import "server-only";
import { cache } from "@/lib/cache";
import { surveyCache } from "@/lib/survey/cache";
import { selectSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";

export const getSurveys = reactCache(
  // [UseTusk]

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
            logger.error({ error }, "getSurveys: Could not fetch surveys");
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
