import { insightCache } from "@/lib/cache/insight";
import {
  TInsightFilterCriteria,
  TInsightWithDocumentCount,
  ZInsightFilterCriteria,
} from "@/modules/ee/insights/experience/types/insights";
import { Insight, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { INSIGHTS_PER_PAGE } from "@formbricks/lib/constants";
import { responseCache } from "@formbricks/lib/response/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getInsights = reactCache(
  async (
    environmentId: string,
    limit?: number,
    offset?: number,
    filterCriteria?: TInsightFilterCriteria
  ): Promise<TInsightWithDocumentCount[]> =>
    cache(
      async () => {
        validateInputs(
          [environmentId, ZId],
          [limit, ZOptionalNumber],
          [offset, ZOptionalNumber],
          [filterCriteria, ZInsightFilterCriteria.optional()]
        );

        limit = limit ?? INSIGHTS_PER_PAGE;
        try {
          const insights = await prisma.insight.findMany({
            where: {
              environmentId,
              documentInsights: {
                some: {
                  document: {
                    createdAt: {
                      gte: filterCriteria?.documentCreatedAt?.min,
                      lte: filterCriteria?.documentCreatedAt?.max,
                    },
                  },
                },
              },
              category: filterCriteria?.category,
            },
            include: {
              _count: {
                select: {
                  documentInsights: {
                    where: {
                      document: {
                        createdAt: {
                          gte: filterCriteria?.documentCreatedAt?.min,
                          lte: filterCriteria?.documentCreatedAt?.max,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: [
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
      [`experience-getInsights-${environmentId}-${limit}-${offset}-${JSON.stringify(filterCriteria)}`],
      {
        tags: [insightCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const updateInsight = async (insightId: string, updates: Partial<Insight>): Promise<void> => {
  try {
    const updatedInsight = await prisma.insight.update({
      where: { id: insightId },
      data: updates,
      select: {
        environmentId: true,
        documentInsights: {
          select: {
            document: {
              select: {
                surveyId: true,
              },
            },
          },
        },
      },
    });

    const uniqueSurveyIds = Array.from(
      new Set(updatedInsight.documentInsights.map((di) => di.document.surveyId))
    );

    insightCache.revalidate({ id: insightId, environmentId: updatedInsight.environmentId });

    for (const surveyId of uniqueSurveyIds) {
      if (surveyId) {
        responseCache.revalidate({
          surveyId,
        });
      }
    }
  } catch (error) {
    logger.error(error, "Error in updateInsight");
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
