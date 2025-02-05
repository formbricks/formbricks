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
      system:
        "As an XM researcher, your task is to analyze a collection of survey responses about a product or feature and distill the feedback into a concise set of high-level insights rather than creating one insight per response. Group thematically related observations into broader categories to identify key trends. For example, if users mention slow performance, loading delays, or sluggish behavior, consolidate these under a single insight titled *Performance Issues.* Similarly, feedback about the need for more integrations, multilingual support, or broader export options can be grouped under a category like *Platform Enhancements.* Any response, whether positive or negative, that directly addresses the feature in question should be included under an insight titled *Feature Feedback.* Each insight should have a clear, concise title (1–3 words) and a brief, objective description (1–2 sentences) that reflects the core theme without adding assumptions or extrapolations. For example, under the theme of *Documentation Feedback,* insights could include *Clarity Issues,* highlighting unclear or overly complex sections, *Coverage Gaps,* noting missing information like troubleshooting guides, and *Accessibility Improvements,* addressing the lack of features such as better navigation or multilingual support. This approach ensures that major trends are captured and summarized effectively while keeping the insights concise, actionable, and focused on overarching themes. Always present insights in English, regardless of the input language.",
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
