import "server-only";
import { Prisma } from "@prisma/client";
import { embed, generateText } from "ai";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { TDocument, TDocumentCreateInput, ZDocumentCreateInput } from "@formbricks/types/documents";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError } from "@formbricks/types/errors";
import { embeddingsModel, llmModel } from "../../../ai/lib/utils";
import { createDocumentGroup, findNearestDocumentGroups } from "../document-group/service";
import { documentCache } from "./cache";

export type TPrismaDocument = Omit<TDocument, "vector"> & {
  vector: string;
};

export const createDocument = async (
  environmentId: string,
  documentInput: TDocumentCreateInput
): Promise<TDocument> => {
  validateInputs([documentInput, ZDocumentCreateInput]);

  try {
    // Generate text embedding
    const { embedding } = await embed({
      model: embeddingsModel,
      value: documentInput.text,
    });

    // find fitting documentGroup
    let documentGroupId;
    const nearestDocumentGroups = await findNearestDocumentGroups(environmentId, embedding, 1, 0.2);
    if (nearestDocumentGroups.length > 0) {
      documentGroupId = nearestDocumentGroups[0].id;
    } else {
      // create documentGroup
      // generate name for documentGroup
      const { text } = await generateText({
        model: llmModel,
        system: `You are a Customer Experience Management platform. You are asked to transform a user feedback into a well defined and consice insight (feature request, complaint, loved feature or bug) like "The dashboard is slow" or "The ability to export data from the app"`,
        prompt: `The user feedback: "${documentInput.text}"`,
      });

      const documentGroup = await createDocumentGroup({
        environmentId,
        text,
      });
      documentGroupId = documentGroup.id;
    }

    // create document
    const prismaDocument = await prisma.document.create({
      data: {
        ...documentInput,
        documentGroupId,
      },
    });

    const document = {
      ...prismaDocument,
      vector: embedding,
    };

    // update document vector with the embedding
    const vectorString = `[${embedding.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE "Document"
      SET "vector" = ${vectorString}::vector(512)
      WHERE "id" = ${document.id};
    `;

    documentCache.revalidate({
      id: document.id,
    });

    // search for nearest documentGroup
    await createDocumentGroup({
      environmentId,
      text: document.text,
    });

    return document;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getDocumentsByResponseIdQuestionId = reactCache(
  (responseId: string, questionId: string): Promise<TDocument[]> =>
    cache(
      async () => {
        validateInputs([responseId, ZId], [questionId, ZId]);

        try {
          const prismaDocuments: TPrismaDocument[] = await prisma.$queryRaw`
            SELECT
              id,
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              "responseId",
              "questionId",
              text,
              vector::text
            FROM "Document" d
            WHERE d."responseId" = ${responseId}
              AND d."questionId" = ${questionId}
          `;

          const documents = prismaDocuments.map((prismaDocument) => {
            // Convert the string representation of the vector back to an array of numbers
            const vector = prismaDocument.vector
              .slice(1, -1) // Remove the surrounding square brackets
              .split(",") // Split the string into an array of strings
              .map(Number); // Convert each string to a number
            return {
              ...prismaDocument,
              vector,
            };
          });

          return documents;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getDocumentsByResponseIdQuestionId-${responseId}-${questionId}`],
      {
        tags: [documentCache.tag.byResponseIdQuestionId(responseId, questionId)],
      }
    )()
);

export const findNearestDocuments = async (
  environmentId: string,
  vector: number[],
  limit: number = 5
): Promise<TDocument[]> => {
  validateInputs([environmentId, ZId]);
  const threshold = 0.8; //0.2;
  // Convert the embedding array to a JSON-like string representation
  const vectorString = `[${vector.join(",")}]`;

  // Execute raw SQL query to find nearest neighbors and exclude the vector column
  const prismaDocuments: TPrismaDocument[] = await prisma.$queryRaw`
    SELECT
      id,
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      text,
      "responseId",
      "questionId",
      vector::text
    FROM "Document" d
    WHERE d."environmentId" = ${environmentId}
      AND d."vector" <=> ${vectorString}::vector(512) <= ${threshold}
    ORDER BY d."vector" <=> ${vectorString}::vector(512)
    LIMIT ${limit};
  `;

  const documents = prismaDocuments.map((prismaDocument) => {
    // Convert the string representation of the vector back to an array of numbers
    const vector = prismaDocument.vector
      .slice(1, -1) // Remove the surrounding square brackets
      .split(",") // Split the string into an array of strings
      .map(Number); // Convert each string to a number
    return {
      ...prismaDocument,
      vector,
    };
  });

  return documents;
};
