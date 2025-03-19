import "server-only";
import { Prisma, Response } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { DatabaseError } from "@formbricks/types/errors";

export const isSurveyResponsePresent = reactCache(
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
      [`link-surveys-isSurveyResponsePresent-${surveyId}-${email}`],
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

export const getExistingContactResponse = reactCache(
  async (surveyId: string, contactId: string): Promise<Pick<Response, "id" | "finished"> | null> =>
    cache(
      async () => {
        try {
          const response = await prisma.response.findFirst({
            where: {
              surveyId,
              contactId,
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
      [`link-surveys-getExisitingContactResponse-${surveyId}-${contactId}`],
      {
        tags: [responseCache.tag.bySurveyId(surveyId), responseCache.tag.byContactId(contactId)],
      }
    )()
);
