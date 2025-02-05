"use server";

import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getSurvey = reactCache(
  async (surveyId: string): Promise<{ environmentId: string } | null> =>
    cache(
      async () => {
        validateInputs([surveyId, ZId]);
        try {
          const survey = await prisma.survey.findUnique({
            where: {
              id: surveyId,
            },
            select: {
              environmentId: true,
            },
          });

          return survey;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`utils-getSurvey-${surveyId}`],
      {
        tags: [surveyCache.tag.byId(surveyId)],
      }
    )()
);

export const getResponse = reactCache(
  async (responseId: string): Promise<{ surveyId: string } | null> =>
    cache(
      async () => {
        validateInputs([responseId, ZId]);

        try {
          const response = await prisma.response.findUnique({
            where: {
              id: responseId,
            },
            select: { surveyId: true },
          });

          return response;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`utils-getResponse-${responseId}`],
      {
        tags: [responseCache.tag.byId(responseId), responseNoteCache.tag.byResponseId(responseId)],
      }
    )()
);
