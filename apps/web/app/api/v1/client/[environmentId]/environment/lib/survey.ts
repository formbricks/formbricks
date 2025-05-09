import { cache } from "@/lib/cache";
import { surveyCache } from "@/lib/survey/cache";
import { validateInputs } from "@/lib/utils/validate";
import { transformPrismaSurvey } from "@/modules/survey/lib/utils";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
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
            orderBy: {
              createdAt: "desc",
            },
            take: 30,
            select: {
              id: true,
              welcomeCard: true,
              name: true,
              questions: true,
              variables: true,
              type: true,
              showLanguageSwitch: true,
              languages: {
                select: {
                  default: true,
                  enabled: true,
                  language: {
                    select: {
                      id: true,
                      code: true,
                      alias: true,
                      createdAt: true,
                      updatedAt: true,
                      projectId: true,
                    },
                  },
                },
              },
              endings: true,
              autoClose: true,
              styling: true,
              status: true,
              recaptcha: true,
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
              isBackButtonHidden: true,
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
              projectOverwrites: true,
            },
          });

          return surveysPrisma.map((survey) => transformPrismaSurvey<TJsEnvironmentStateSurvey>(survey));
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error, "Error getting surveys for environment state");
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
