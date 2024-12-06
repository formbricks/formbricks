import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { transformPrismaSurvey } from "@formbricks/lib/survey/utils";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";

export const getSurveysForEnvironmentState = reactCache(
  async (environmentId: string): Promise<TJsEnvironmentStateSurvey[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);

        try {
          const surveysPrisma = await prisma.survey.findMany({
            where: {
              environmentId,
            },
            select: {
              id: true,
              welcomeCard: true,
              name: true,
              questions: true,
              variables: true,
              type: true,
              showLanguageSwitch: true,
              languages: true,
              endings: true,
              autoClose: true,
              styling: true,
              status: true,
              segment: {
                include: {
                  surveys: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
              recontactDays: true,
              displayLimit: true,
              displayOption: true,
              hiddenFields: true,
              triggers: {
                select: {
                  actionClass: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              displayPercentage: true,
              delay: true,
            },
          });

          return surveysPrisma.map((survey) => transformPrismaSurvey<TJsEnvironmentStateSurvey>(survey));
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getSurveysForEnvironmentState-${environmentId}`],
      {
        tags: [surveyCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
