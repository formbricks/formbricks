import { documentCache } from "@/lib/cache/document";
import { Prisma } from "@prisma/client";
import { embed, generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { embeddingsModel, llmModel } from "@formbricks/lib/aiModels";
import { validateInputs } from "@formbricks/lib/utils/validate";
import {
  TDocument,
  TDocumentCreateInput,
  TGenerateDocumentObjectSchema,
  ZDocumentCreateInput,
  ZGenerateDocumentObjectSchema,
} from "@formbricks/types/documents";
import { DatabaseError } from "@formbricks/types/errors";

export type TCreatedDocument = TDocument & {
  isSpam: boolean;
  insights: TGenerateDocumentObjectSchema["insights"];
};

export const createDocument = async (
  surveyName: string,
  documentInput: TDocumentCreateInput
): Promise<TCreatedDocument> => {
  validateInputs([surveyName, z.string()], [documentInput, ZDocumentCreateInput]);

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
      schema: ZGenerateDocumentObjectSchema,
      system: `You are an XM researcher. You analyse a survey response (survey name, question headline & user answer) and generate insights from it. The insight title (1-3 words) should concisely answer the question, e.g., "What type of people do you think would most benefit" -> "Developers". You are very objective. For the insights, split the feedback into the smallest parts possible and only use the feedback itself to draw conclusions. You must output at least one insight. Always generate insights and titles in English, regardless of the input language.`,
      prompt: `Survey: ${surveyName}\n${documentInput.text}`,
      temperature: 0,
      experimental_telemetry: { isEnabled: true },
    });

    const sentiment = object.sentiment;
    const isSpam = object.isSpam;

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

    documentCache.revalidate({
      id: document.id,
      responseId: document.responseId,
      questionId: document.questionId,
    });

    return { ...document, insights: object.insights, isSpam };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
