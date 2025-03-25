import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getSurveyMetadata = reactCache(async (surveyId: string) =>
  cache(
    async () => {
      try {
        const survey = await prisma.survey.findUnique({
          where: {
            id: surveyId,
          },
          select: {
            id: true,
            type: true,
            status: true,
            environmentId: true,
            name: true,
            styling: true,
            questions: true,
            endings: true,
          },
        });

        if (!survey) {
          throw new ResourceNotFoundError("Survey", surveyId);
        }

        return survey;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(error);
          throw new DatabaseError(error.message);
        }
        throw error;
      }
    },

    [`link-survey-getSurveyMetadata-${surveyId}`],
    {
      tags: [surveyCache.tag.byId(surveyId)],
    }
  )()
);

export const getSurveyPin = reactCache(async (surveyId: string) =>
  cache(
    async () => {
      const survey = await prisma.survey.findUnique({
        where: {
          id: surveyId,
        },
        select: {
          pin: true,
        },
      });

      if (!survey) {
        throw new ResourceNotFoundError("Survey", surveyId);
      }

      return survey.pin;
    },
    [`link-survey-getSurveyPin-${surveyId}`],
    {
      tags: [surveyCache.tag.byId(surveyId)],
    }
  )()
);
