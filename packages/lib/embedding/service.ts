import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { TEmbedding, TEmbeddingCreateInput, ZEmbeddingCreateInput } from "@formbricks/types/embedding";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "../utils/validate";
import { embeddingCache } from "./cache";

export const createEmbedding = async (
  productId: string,
  embeddingInput: TEmbeddingCreateInput
): Promise<TEmbedding> => {
  validateInputs([productId, ZId], [embeddingInput, ZEmbeddingCreateInput]);

  try {
    const vectorString = embeddingInput.vector.join(",");

    const result = await prisma.$executeRaw`
      INSERT INTO Embedding (referenceId, created_at, updated_at, type, vector)
      VALUES (${embeddingInput.referenceId}, NOW(), NOW(), ${embeddingInput.type}, '${vectorString}')
    `;

    const embedding: TEmbedding = await prisma.$queryRaw`
SELECT * FROM Embedding WHERE referenceId = ${embeddingInput.referenceId}
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
