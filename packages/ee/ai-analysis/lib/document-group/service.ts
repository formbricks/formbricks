import "server-only";
import { Prisma } from "@prisma/client";
import { embed } from "ai";
import { prisma } from "@formbricks/database";
import { validateInputs } from "@formbricks/lib/utils/validate";
import {
  TDocumentGroup,
  TDocumentGroupCreateInput,
  ZDocumentGroupCreateInput,
} from "@formbricks/types/document-groups";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError } from "@formbricks/types/errors";
import { embeddingsModel } from "../../../ai/lib/utils";
import { documentGroupCache } from "./cache";

export type TPrismaDocumentGroup = Omit<TDocumentGroup, "vector"> & {
  vector: string;
};

export const createDocumentGroup = async (
  documentGroupInput: TDocumentGroupCreateInput
): Promise<TDocumentGroup> => {
  validateInputs([documentGroupInput, ZDocumentGroupCreateInput]);

  try {
    // Generate text embedding
    const embeddingPromise = embed({
      model: embeddingsModel,
      value: documentGroupInput.text,
    });

    // create document
    const prismaDocumentGroupPromise = prisma.documentGroup.create({
      data: documentGroupInput,
    });

    const [embeddingRes, prismaDocument] = await Promise.all([embeddingPromise, prismaDocumentGroupPromise]);

    const { embedding } = embeddingRes;

    const documentGroup = {
      ...prismaDocument,
      vector: embedding,
    };

    // update document vector with the embedding
    const vectorString = `[${embedding.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE "DocumentGroup"
      SET "vector" = ${vectorString}::vector(512)
      WHERE "id" = ${documentGroup.id};
    `;

    documentGroupCache.revalidate({
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

export const findNearestDocumentGroups = async (
  environmentId: string,
  vector: number[],
  limit: number = 5,
  threshold: number = 0.5
): Promise<TDocumentGroup[]> => {
  validateInputs([environmentId, ZId]);
  // Convert the embedding array to a JSON-like string representation
  const vectorString = `[${vector.join(",")}]`;

  // Execute raw SQL query to find nearest neighbors and exclude the vector column
  const prismaDocumentGroups: TPrismaDocumentGroup[] = await prisma.$queryRaw`
    SELECT
      id,
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      text,
      "environmentId",
      vector::text
    FROM "DocumentGroup" d
    WHERE d."environmentId" = ${environmentId}
      AND d."vector" <=> ${vectorString}::vector(512) <= ${threshold}
    ORDER BY d."vector" <=> ${vectorString}::vector(512)
    LIMIT ${limit};
  `;

  const documentGroups = prismaDocumentGroups.map((prismaDocumentGroup) => {
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

  return documentGroups;
};
