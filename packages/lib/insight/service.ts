import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import {
  TInsight,
  TInsightCreateInput,
  TInsightFilterCriteria,
  ZInsightCreateInput,
  ZInsightFilterCriteria,
} from "@formbricks/types/insights";
import { cache } from "../cache";
import { INSIGHTS_PER_PAGE } from "../constants";
import { documentCache } from "../document/cache";
import { validateInputs } from "../utils/validate";
import { insightCache } from "./cache";

export const getInsight = reactCache(
  (id: string): Promise<TInsight | null> =>
    cache(
      async () => {
        validateInputs([id, ZId]);

        try {
          const insight = await prisma.insight.findUnique({
            where: {
              id,
            },
            include: {
              _count: {
                select: {
                  documentInsights: true,
                },
              },
            },
          });

          return insight;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getInsight-${id}`],
      {
        tags: [insightCache.tag.byId(id)],
      }
    )()
);

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
            },
            include: {
              _count: {
                select: {
                  documentInsights: true,
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
      [`getInsights-${environmentId}-${limit}-${offset}-${JSON.stringify(filterCriteria)}`],
      {
        tags: [insightCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const getInsightsBySurveyId = reactCache(
  (surveyId: string, limit?: number, offset?: number): Promise<TInsight[]> =>
    cache(
      async () => {
        validateInputs([surveyId, ZId]);

        limit = limit ?? INSIGHTS_PER_PAGE;
        try {
          const insights = await prisma.insight.findMany({
            where: {
              documentInsights: {
                some: {
                  document: {
                    surveyId,
                  },
                },
              },
            },
            include: {
              _count: {
                select: {
                  documentInsights: true,
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
      [`getInsightsBySurveyId-${surveyId}-${limit}-${offset}`],
      {
        tags: [documentCache.tag.bySurveyId(surveyId)],
      }
    )()
);

export const getInsightsBySurveyIdQuestionId = reactCache(
  (surveyId: string, questionId: string, limit?: number, offset?: number): Promise<TInsight[]> =>
    cache(
      async () => {
        validateInputs([surveyId, ZId], [questionId, ZId]);

        limit = limit ?? INSIGHTS_PER_PAGE;
        try {
          const insights = await prisma.insight.findMany({
            where: {
              documentInsights: {
                some: {
                  document: {
                    surveyId,
                    questionId,
                  },
                },
              },
            },
            include: {
              _count: {
                select: {
                  documentInsights: true,
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
      [`getInsightsBySurveyIdQuestionId-${surveyId}-${limit}-${offset}`],
      {
        tags: [documentCache.tag.bySurveyId(surveyId)],
      }
    )()
);

export const createInsight = async (insightGroupInput: TInsightCreateInput): Promise<TInsight> => {
  validateInputs([insightGroupInput, ZInsightCreateInput]);

  try {
    // create document
    const { vector, ...data } = insightGroupInput;
    const prismaInsight = await prisma.insight.create({
      data,
    });

    const insight = {
      ...prismaInsight,
      _count: {
        documentInsights: 0,
      },
    };

    // update document vector with the embedding
    const vectorString = `[${insightGroupInput.vector.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE "Insight"
      SET "vector" = ${vectorString}::vector(512)
      WHERE "id" = ${insight.id};
    `;

    insightCache.revalidate({
      id: insight.id,
      environmentId: insight.environmentId,
    });

    return insight;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const findNearestInsights = async (
  environmentId: string,
  vector: number[],
  limit: number = 5,
  threshold: number = 0.5
): Promise<TInsight[]> => {
  validateInputs([environmentId, ZId]);
  // Convert the embedding array to a JSON-like string representation
  const vectorString = `[${vector.join(",")}]`;

  // Execute raw SQL query to find nearest neighbors and exclude the vector column
  const insights: TInsight[] = await prisma.$queryRaw`
    SELECT
      id,
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      title,
      description,
      category,
      "environmentId"
    FROM "Insight" d
    WHERE d."environmentId" = ${environmentId}
      AND d."vector" <=> ${vectorString}::vector(512) <= ${threshold}
    ORDER BY d."vector" <=> ${vectorString}::vector(512)
    LIMIT ${limit};
  `;

  return insights;
};
