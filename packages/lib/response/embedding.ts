import { prisma } from "@formbricks/database";
import { type TEmbedding, ZEmbedding } from "@formbricks/types/embedding";
import { ZId } from "@formbricks/types/environment";
import { validateInputs } from "../utils/validate";

export const updateResponseEmbedding = async (id: string, embedding: TEmbedding) => {
  validateInputs([id, ZId], [embedding, ZEmbedding]);
  // Convert the embedding array to a string representation that PostgreSQL understands
  const embeddingString = `[${embedding.join(",")}]`;

  await prisma.$executeRaw`
      UPDATE "Response"
      SET "embedding" = ${embeddingString}::vector(1024)
      WHERE "id" = ${id};
    `;
};
