import { insightCache } from "@/lib/cache/insight";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { INSIGHTS_PER_PAGE } from "@formbricks/lib/constants";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TInsight, TInsightFilterCriteria, ZInsightFilterCriteria } from "@formbricks/types/insights";

export const getInsights = reactCache(
  (
    environmentId: string,
    limit?: number,
    offset?: number,
    filterCriteria?: TInsightFilterCriteria
  ): Promise<TInsight[]> =>
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

export const updateInsight = async (insightId: string, updates: Partial<TInsight>): Promise<void> => {
  try {
    await prisma.insight.update({
      where: { id: insightId },
      data: updates,
    });

    // Invalidate the cache for the updated insight
    insightCache.revalidate({ id: insightId });
  } catch (error) {
    console.error("Error in updateInsight:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
