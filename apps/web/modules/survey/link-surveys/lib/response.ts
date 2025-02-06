import "server-only";
import { Prisma, Response } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { DatabaseError } from "@formbricks/types/errors";

export const getIfResponseWithSurveyIdAndEmailExist = reactCache(
  async (surveyId: string, email: string): Promise<boolean> =>
    cache(
      async () => {
        try {
          const response = await prisma.response.findFirst({
            where: {
              surveyId,
              data: {
                path: ["verifiedEmail"],
                equals: email,
              },
            },
            select: { id: true },
          });

          return !!response;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`link-surveys-getIfResponseWithSurveyIdAndEmailExist-${surveyId}-${email}`],
      {
        tags: [responseCache.tag.bySurveyId(surveyId)],
      }
    )()
);

export const getResponseCountBySurveyId = reactCache(
  async (surveyId: string): Promise<number> =>
    cache(
      async () => {
        try {
          const responseCount = await prisma.response.count({
            where: {
              surveyId,
            },
          });
          return responseCount;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`link-surveys-getResponseCountBySurveyId-${surveyId}`],
      {
        tags: [responseCache.tag.bySurveyId(surveyId)],
      }
    )()
);

export const getResponseBySingleUseId = reactCache(
  async (surveyId: string, singleUseId: string): Promise<Pick<Response, "id" | "finished"> | null> =>
    cache(
      async () => {
        try {
          const response = await prisma.response.findFirst({
            where: {
              surveyId,
              singleUseId,
            },
            select: {
              id: true,
              finished: true,
            },
          });

          return response;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`link-surveys-getResponseBySingleUseId-${surveyId}-${singleUseId}`],
      {
        tags: [responseCache.tag.bySingleUseId(surveyId, singleUseId)],
      }
    )()
);
