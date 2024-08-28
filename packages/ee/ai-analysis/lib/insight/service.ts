import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError } from "@formbricks/types/errors";
import { TInsight, TInsightCreateInput, ZInsightCreateInput } from "@formbricks/types/insights";
import { insightCache } from "./cache";

const INSIGHTS_PER_PAGE = 10;

export const getInsights = reactCache(
  (environmentId: string, limit?: number, offset?: number): Promise<TInsight[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);

        limit = limit ?? INSIGHTS_PER_PAGE;
        try {
          const insights = await prisma.insight.findMany({
            where: {
              environmentId,
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
      [`getInsights-${environmentId}-${limit}-${offset}`],
      {
        tags: [insightCache.tag.byEnvironmentId(environmentId)],
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

    const documentGroup = {
      ...prismaInsight,
      vector: insightGroupInput.vector,
    };

    // update document vector with the embedding
    const vectorString = `[${insightGroupInput.vector.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE "Insight"
      SET "vector" = ${vectorString}::vector(512)
      WHERE "id" = ${documentGroup.id};
    `;

    insightCache.revalidate({
      id: documentGroup.id,
      environmentId: documentGroup.environmentId,
    });

    return documentGroup;
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
