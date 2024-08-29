import "server-only";
import { Prisma } from "@prisma/client";
import { embed, generateObject } from "ai";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import {
  TDocument,
  TDocumentCreateInput,
  ZDocumentCreateInput,
  ZDocumentSentiment,
} from "@formbricks/types/documents";
import { DatabaseError } from "@formbricks/types/errors";
import { ZInsightCategory } from "@formbricks/types/insights";
import { embeddingsModel, llmModel } from "../ai";
import { cache } from "../cache";
import { validateInputs } from "../utils/validate";
import { documentCache } from "./cache";
import { handleInsightAssignments } from "./utils";

export type TPrismaDocument = Omit<TDocument, "vector"> & {
  vector: string;
};

export const createDocument = async (documentInput: TDocumentCreateInput): Promise<TDocument> => {
  validateInputs([documentInput, ZDocumentCreateInput]);

  try {
    // Generate text embedding
    const { embedding } = await embed({
      model: embeddingsModel,
      value: documentInput.text,
    });

    // generate sentiment and insights
    const { object } = await generateObject({
      model: llmModel,
      schema: z.object({
        sentiment: ZDocumentSentiment,
        insights: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            category: ZInsightCategory,
          })
        ),
      }),
      system: `You are an XM researcher. You analyse user feedback and extract insights and the sentiment from it. You are very objective, for the insights split the feedback in the smallest parts possible and only use the feedback itself to draw conclusions. An insight consist of a title and description (e.g. title: "Interactive charts and graphics", description: "Users would love to see a visualization of the analytics data") as well as tag it with the right category`,
      prompt: `Analyze this feedback: "${documentInput.text}"`,
    });

    const sentiment = object.sentiment;
    const insights = object.insights;

    // create document
    const prismaDocument = await prisma.document.create({
      data: {
        ...documentInput,
        sentiment,
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

    // connect or create the insights
    const insightPromises: Promise<void>[] = [];
    for (const insight of insights) {
      if (typeof insight.title !== "string" || typeof insight.description !== "string") {
        throw new Error("Insight title and description must be a string");
      }

      // create or connect the insight
      insightPromises.push(handleInsightAssignments(documentInput.environmentId, document.id, insight));
    }
    await Promise.all(insightPromises);

    documentCache.revalidate({
      id: document.id,
      environmentId: document.environmentId,
      surveyId: document.surveyId,
      responseId: document.responseId,
      questionId: document.questionId,
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
  limit: number = 5,
  threshold: number = 0.5
): Promise<TDocument[]> => {
  validateInputs([environmentId, ZId]);
  // Convert the embedding array to a JSON-like string representation
  const vectorString = `[${vector.join(",")}]`;

  // Execute raw SQL query to find nearest neighbors and exclude the vector column
  const prismaDocuments: TPrismaDocument[] = await prisma.$queryRaw`
    SELECT
      id,
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      "environmentId",
      text,
      "responseId",
      "questionId",
      "documentGroupId",
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
