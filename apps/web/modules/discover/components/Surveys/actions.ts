"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { transformPrismaSurvey } from "@formbricks/lib/survey/utils";
import { TSurvey } from "@formbricks/types/surveys/types";

const ZGetAvailableSurveysAction = z.object({
  take: z.number(),
  skip: z.number(),
});

export const getCompletedSurveysAction = authenticatedActionClient
  .schema(ZGetAvailableSurveysAction)
  .action(async ({ ctx, parsedInput }) => {
    const surveysPrisma = await prisma.survey.findMany({
      where: {
        responses: {
          some: {
            data: {
              path: ["verifiedEmail"],
              equals: ctx.user.email,
            },
          },
        },
      },
      include: {
        responses: {
          where: {
            data: {
              path: ["verifiedEmail"],
              equals: ctx.user.email,
            },
          },
        },
      },
      take: parsedInput.take,
      skip: parsedInput.skip,
    });
    return surveysPrisma.map((surveyPrisma) => transformPrismaSurvey<TSurvey>(surveyPrisma));
  });

export const getAvailableSurveysAction = authenticatedActionClient
  .schema(ZGetAvailableSurveysAction)
  .action(async ({ ctx, parsedInput }) => {
    const surveysPrisma = await prisma.survey.findMany({
      where: {
        public: true,
        status: "inProgress",
        responses: {
          none: {
            data: {
              path: ["verifiedEmail"],
              equals: ctx.user.email,
            },
          },
        },
      },
      take: parsedInput.take,
      skip: parsedInput.skip,
    });
    return surveysPrisma.map((surveyPrisma) => transformPrismaSurvey<TSurvey>(surveyPrisma));
  });
