"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { z } from "zod";
import { prisma } from "@formbricks/database";

const ZGetAvailableSurveysAction = z.object({
  take: z.number(),
  skip: z.number(),
});

export const getCompletedSurveysAction = authenticatedActionClient
  .schema(ZGetAvailableSurveysAction)
  .action(async ({ ctx, parsedInput }) => {
    return prisma.survey.findMany({
      where: {
        public: true,
        status: "inProgress",
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
  });

export const getAvailableSurveysAction = authenticatedActionClient
  .schema(ZGetAvailableSurveysAction)
  .action(async ({ ctx, parsedInput }) => {
    return prisma.survey.findMany({
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
  });
