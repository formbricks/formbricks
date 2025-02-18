import { documentCache } from "@/lib/cache/document";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { INSIGHTS_PER_PAGE } from "@formbricks/lib/constants";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import {
  TSurveyQuestionId,
  TSurveyQuestionSummaryOpenText,
  ZSurveyQuestionId,
} from "@formbricks/types/surveys/types";

export const getInsightsBySurveyIdQuestionId = reactCache(
  async (
    surveyId: string,
    questionId: TSurveyQuestionId,
    insightResponsesIds: string[],
    limit?: number,
    offset?: number
  ): Promise<TSurveyQuestionSummaryOpenText["insights"]> =>
    cache(
      async () => {
        validateInputs([surveyId, ZId], [questionId, ZSurveyQuestionId]);

        limit = limit ?? INSIGHTS_PER_PAGE;
        try {
          const insights = await prisma.insight.findMany({
            where: {
              documentInsights: {
                some: {
                  document: {
                    surveyId,
                    questionId,
                    ...(insightResponsesIds.length > 0 && {
                      responseId: {
                        in: insightResponsesIds,
                      },
                    }),
                  },
                },
              },
            },
            include: {
              _count: {
                select: {
                  documentInsights: {
                    where: {
                      document: {
                        surveyId,
                        questionId,
                      },
                    },
                  },
                },
              },
            },
            orderBy: [
              {
                documentInsights: {
                  _count: "desc",
                },
              },
              {
                createdAt: "desc",
              },
            ],
            take: limit ? limit : undefined,
            skip: offset ? offset : undefined,
          });

          return insights;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getInsightsBySurveyIdQuestionId-${surveyId}-${questionId}-${limit}-${offset}`],
      {
        tags: [documentCache.tag.bySurveyId(surveyId)],
      }
    )()
);
