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
  TDocumentFilterCriteria,
  ZDocumentCreateInput,
  ZDocumentFilterCriteria,
  ZDocumentSentiment,
} from "@formbricks/types/documents";
import { DatabaseError } from "@formbricks/types/errors";
import { ZInsightCategory } from "@formbricks/types/insights";
import { embeddingsModel, llmModel } from "../aiModels";
import { cache } from "../cache";
import { insightCache } from "../insight/cache";
import { getSurvey } from "../survey/service";
import { validateInputs } from "../utils/validate";
import { documentCache } from "./cache";
import { handleInsightAssignments } from "./utils";

const DOCUMENTS_PER_PAGE = 10;

export type TPrismaDocument = Omit<TDocument, "vector"> & {
  vector: string;
};

export const getDocumentsByInsightId = reactCache(
  (
    insightId: string,
    limit?: number,
    offset?: number,
    filterCriteria?: TDocumentFilterCriteria
  ): Promise<TDocument[]> =>
    cache(
      async () => {
        validateInputs(
          [insightId, ZId],
          [limit, z.number().optional()],
          [offset, z.number().optional()],
          [filterCriteria, ZDocumentFilterCriteria.optional()]
        );

        limit = limit ?? DOCUMENTS_PER_PAGE;
        try {
          const documents = await prisma.document.findMany({
            where: {
              documentInsights: {
                some: {
                  insightId,
                },
              },
              createdAt: {
                gte: filterCriteria?.createdAt?.min,
                lte: filterCriteria?.createdAt?.max,
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

          return documents;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getDocumentsByInsightId-${insightId}-${limit}-${offset}`],
      {
        tags: [documentCache.tag.byInsightId(insightId), insightCache.tag.byId(insightId)],
      }
    )()
);

export const getDocumentsByInsightIdSurveyIdQuestionId = reactCache(
  (
    insightId: string,
    surveyId: string,
    questionId: string,
    limit?: number,
    offset?: number
  ): Promise<TDocument[]> =>
    cache(
      async () => {
        validateInputs(
          [insightId, ZId],
          [surveyId, ZId],
          [questionId, ZId],
          [limit, z.number().optional()],
          [offset, z.number().optional()]
        );

        limit = limit ?? DOCUMENTS_PER_PAGE;
        try {
          const documents = await prisma.document.findMany({
            where: {
              questionId,
              surveyId,
              documentInsights: {
                some: {
                  insightId,
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

          return documents;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getDocumentsByInsightIdSurveyIdQuestionId-${insightId}-${surveyId}-${questionId}-${limit}-${offset}`],
      {
        tags: [
          documentCache.tag.byInsightIdSurveyIdQuestionId(insightId, surveyId, questionId),
          insightCache.tag.byId(insightId),
        ],
      }
    )()
);

export const createDocument = async (documentInput: TDocumentCreateInput): Promise<TDocument> => {
  validateInputs([documentInput, ZDocumentCreateInput]);

  const survey = await getSurvey(documentInput.surveyId);

  if (!survey) {
    throw new Error("Survey not found");
  }

  try {
    // Generate text embedding
    const { embedding } = await embed({
      model: embeddingsModel,
      value: documentInput.text,
      experimental_telemetry: { isEnabled: true },
    });

    // generate sentiment and insights
    const { object } = await generateObject({
      model: llmModel,
      schema: z.object({
        sentiment: ZDocumentSentiment,
        insights: z.array(
          z.object({
            title: z.string().max(25).describe("insight that works standalone, very specific, 'Dark Mode'"),
            description: z
              .string()
              .describe("very brief insight, generic, e.g. 'Users would love to see support for dark mode'"),
            category: ZInsightCategory,
          })
        ),
        isSpam: z.boolean(),
      }),
      system: `You are an XM researcher. You analyse a survey response (survey name, question headline & user answer) and generate insights from it. The insight title (1-3 words) should concicely answer the question. You are very objective, for the insights split the feedback in the smallest parts possible and only use the feedback itself to draw conclusions. You must output at least one insight.`,
      prompt: `Survey: ${survey.name}\n${documentInput.text}`,
      temperature: 0,
      experimental_telemetry: { isEnabled: true },
    });

    const sentiment = object.sentiment;
    const isSpam = object.isSpam;
    const insights = object.insights;

    // create document
    const prismaDocument = await prisma.document.create({
      data: {
        ...documentInput,
        sentiment,
        isSpam,
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
    if (!isSpam) {
      for (const insight of insights) {
        if (typeof insight.title !== "string" || typeof insight.description !== "string") {
          throw new Error("Insight title and description must be a string");
        }

        // create or connect the insight
        insightPromises.push(handleInsightAssignments(documentInput.environmentId, document.id, insight));
      }
      await Promise.all(insightPromises);
    }

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

export const doesDocumentExistForResponseId = reactCache(
  (responseId: string): Promise<boolean> =>
    cache(
      async () => {
        validateInputs([responseId, ZId]);

        try {
          const document = await prisma.document.findFirst({
            where: {
              responseId,
            },
          });

          return !!document;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`doesDocumentExistForResponseId-${responseId}`],
      {
        tags: [documentCache.tag.byResponseId(responseId)],
      }
    )()
);
