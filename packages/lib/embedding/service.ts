import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZString } from "@formbricks/types/common";
import {
  TEmbedding,
  TEmbeddingCreateInput,
  ZEmbeddingCreateInput,
  ZEmbeddingType,
} from "@formbricks/types/embedding";
import { DatabaseError } from "@formbricks/types/errors";
import { cache } from "../cache";
import { validateInputs } from "../utils/validate";
import { embeddingCache } from "./cache";

export type TPrismaEmbedding = Omit<TEmbedding, "vector"> & {
  vector: string;
};

export const createEmbedding = async (embeddingInput: TEmbeddingCreateInput): Promise<TEmbedding> => {
  validateInputs([embeddingInput, ZEmbeddingCreateInput]);

  try {
    const { vector, ...data } = embeddingInput;

    const prismaEmbedding = await prisma.embedding.create({
      data,
    });

    const embedding = {
      ...prismaEmbedding,
      vector,
    };

    // update vector
    const vectorString = `[${vector.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE "Embedding"
      SET "vector" = ${vectorString}::vector(512)
      WHERE "id" = ${embedding.id};
    `;

    embeddingCache.revalidate({
      referenceId: embedding.referenceId,
    });

    return embedding;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getEmbeddingsByTypeAndReferenceId = reactCache(
  (type: string, referenceId: string): Promise<TEmbedding[]> =>
    cache(
      async () => {
        validateInputs([type, ZEmbeddingType], [referenceId, ZString]);

        try {
          const prismaEmbeddings: TPrismaEmbedding[] = await prisma.$queryRaw`
            SELECT
              id,
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              type,
              "referenceId",
              vector::text
            FROM "Embedding" e
            WHERE e."type" = ${type}::"EmbeddingType"
              AND e."referenceId" = ${referenceId}
          `;

          const embeddings = prismaEmbeddings.map((prismaEmbedding) => {
            // Convert the string representation of the embedding back to an array of numbers
            const vector = prismaEmbedding.vector
              .slice(1, -1) // Remove the surrounding square brackets
              .split(",") // Split the string into an array of strings
              .map(Number); // Convert each string to a number
            return {
              ...prismaEmbedding,
              vector,
            };
          });

          return embeddings;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getEmbeddingsByTypeAndReferenceId-${type}-${referenceId}`],
      {
        tags: [embeddingCache.tag.byTypeAndReferenceId(type, referenceId)],
      }
    )()
);
