import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { selectSurvey } from "@formbricks/lib/survey/service";
import { transformPrismaSurvey } from "@formbricks/lib/survey/utils";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";

export const getSurvey = reactCache(
  async (surveyId: string): Promise<TSurvey | null> =>
    cache(
      async () => {
        let surveyPrisma;
        try {
          surveyPrisma = await prisma.survey.findUnique({
            where: {
              id: surveyId,
            },
            select: selectSurvey,
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }

        if (!surveyPrisma) {
          return null;
        }

        return transformPrismaSurvey<TSurvey>(surveyPrisma);
      },
      [`link-survey-getSurvey-${surveyId}`],
      {
        tags: [surveyCache.tag.byId(surveyId)],
      }
    )()
);
