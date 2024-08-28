import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError } from "@formbricks/types/errors";
import { TInsight, TInsightCreateInput, ZInsightCreateInput } from "@formbricks/types/insights";
import { insightCache } from "./cache";

export type TPrismaInsight = Omit<TInsight, "vector"> & {
  vector: string;
};

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
  const prismaInsights: TPrismaInsight[] = await prisma.$queryRaw`
    SELECT
      id,
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      title,
      description,
      category,
      "environmentId",
      vector::text
    FROM "Insight" d
    WHERE d."environmentId" = ${environmentId}
      AND d."vector" <=> ${vectorString}::vector(512) <= ${threshold}
    ORDER BY d."vector" <=> ${vectorString}::vector(512)
    LIMIT ${limit};
  `;

  const insights = prismaInsights.map((prismaDocumentGroup) => {
    // Convert the string representation of the vector back to an array of numbers
    const vector = prismaDocumentGroup.vector
      .slice(1, -1) // Remove the surrounding square brackets
      .split(",") // Split the string into an array of strings
      .map(Number); // Convert each string to a number
    return {
      ...prismaDocumentGroup,
      vector,
    };
  });

  return insights;
};
