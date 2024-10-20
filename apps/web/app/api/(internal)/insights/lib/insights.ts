import { createDocument } from "@/app/api/(internal)/insights/lib/document";
import { doesResponseHasAnyOpenTextAnswer } from "@/app/api/(internal)/insights/lib/utils";
import { documentCache } from "@/lib/cache/document";
import { insightCache } from "@/lib/cache/insight";
import { Prisma } from "@prisma/client";
import { embed } from "ai";
import { prisma } from "@formbricks/database";
import { embeddingsModel } from "@formbricks/lib/aiModels";
import { getPromptText } from "@formbricks/lib/utils/ai";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import {
  TInsight,
  TInsightCategory,
  TInsightCreateInput,
  ZInsightCreateInput,
} from "@formbricks/types/insights";
import {
  TSurveyQuestionId,
  TSurveyQuestionTypeEnum,
  TSurveyQuestions,
  ZSurveyQuestions,
} from "@formbricks/types/surveys/types";

export const generateInsightsForSurveyResponsesConcept = async (surveyData: {
  id: string;
  name: string;
  environmentId: string;
  questions: TSurveyQuestions;
}): Promise<void> => {
  const startTime = Date.now();
  console.log(`Generating insights for survey responses: ${surveyData.id} at ${startTime}`);
  const { id: surveyId, name, environmentId, questions } = surveyData;

  validateInputs([surveyId, ZId], [environmentId, ZId], [questions, ZSurveyQuestions]);

  try {
    const openTextQuestionsWithInsights = questions.filter(
      (question) => question.type === TSurveyQuestionTypeEnum.OpenText && question.insightsEnabled
    );

    const openTextQuestionIds = openTextQuestionsWithInsights.map((question) => question.id);

    if (openTextQuestionIds.length === 0) {
      return;
    }

    // Fetching responses
    const batchSize = 200;
    let skip = 0;
    let rateLimit: number | undefined;
    const spillover: { responseId: string; questionId: string; text: string }[] = [];
    let allResponsesProcessed = false;

    // Fetch the rate limit once, if not already set
    if (rateLimit === undefined) {
      const { rawResponse } = await embed({
        model: embeddingsModel,
        value: "Test",
        experimental_telemetry: { isEnabled: true },
      });

      const rateLimitHeader = rawResponse?.headers?.["x-ratelimit-remaining-requests"];
      rateLimit = rateLimitHeader ? parseInt(rateLimitHeader, 10) : undefined;
    }

    console.log(`Rate limit for embedding API: ${rateLimit}`);
    while (!allResponsesProcessed || spillover.length > 0) {
      // If there are any spillover documents from the previous iteration, prioritize them
      let answersForDocumentCreation = [...spillover];
      spillover.length = 0; // Empty the spillover array after moving contents

      // Fetch new responses only if spillover is empty
      if (answersForDocumentCreation.length === 0 && !allResponsesProcessed) {
        const responses = await prisma.response.findMany({
          where: {
            surveyId,
            documents: {
              none: {},
            },
            finished: true,
          },
          select: {
            id: true,
            data: true,
          },
          take: batchSize,
          skip,
        });

        if (responses.length === 0) {
          allResponsesProcessed = true; // Mark as finished when no more responses are found
        }

        const responsesWithOpenTextAnswers = responses.filter((response) =>
          doesResponseHasAnyOpenTextAnswer(openTextQuestionIds, response.data)
        );

        skip += batchSize - responsesWithOpenTextAnswers.length;

        responsesWithOpenTextAnswers.forEach((response) => {
          openTextQuestionsWithInsights.forEach((question) => {
            const responseText = response.data[question.id] as string;
            if (responseText) {
              const text = getPromptText(question.headline.default, responseText);
              answersForDocumentCreation.push({
                responseId: response.id,
                questionId: question.id,
                text,
              });
            }
          });
        });
      }

      // Process documents only up to the rate limit
      if (rateLimit !== undefined && rateLimit < answersForDocumentCreation.length) {
        // Push excess documents to the spillover array
        spillover.push(...answersForDocumentCreation.slice(rateLimit));
        answersForDocumentCreation = answersForDocumentCreation.slice(0, rateLimit);
      }

      console.log(
        `Processing ${answersForDocumentCreation.length} documents and spillover: ${spillover.length}`
      );

      const createDocumentPromises = answersForDocumentCreation.map((answer) => {
        return createDocument(name, {
          environmentId,
          surveyId,
          responseId: answer.responseId,
          questionId: answer.questionId,
          text: answer.text,
        });
      });

      const createDocumentResults = await Promise.all(createDocumentPromises);
      const createdDocuments = createDocumentResults.filter(Boolean);

      for (const document of createdDocuments) {
        if (document) {
          const insightPromises: Promise<void>[] = [];
          const { insights, isSpam, id, environmentId } = document;
          if (!isSpam) {
            for (const insight of insights) {
              if (typeof insight.title !== "string" || typeof insight.description !== "string") {
                throw new Error("Insight title and description must be a string");
              }

              // Create or connect the insight
              insightPromises.push(handleInsightAssignments(environmentId, id, insight));
            }
            await Promise.all(insightPromises);
          }
        }
      }

      documentCache.revalidate({
        environmentId: environmentId,
        surveyId: surveyId,
      });
      console.log(
        `Processed ${createdDocuments.length} documents in ${(Date.now() - startTime) / 1000} seconds`
      );
    }

    return;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const generateInsightsForSurveyResponses = async (surveyData: {
  id: string;
  name: string;
  environmentId: string;
  questions: TSurveyQuestions;
}): Promise<void> => {
  const { id: surveyId, name, environmentId, questions } = surveyData;

  validateInputs([surveyId, ZId], [environmentId, ZId], [questions, ZSurveyQuestions]);
  try {
    const openTextQuestionsWithInsights = questions.filter(
      (question) => question.type === TSurveyQuestionTypeEnum.OpenText && question.insightsEnabled
    );

    const openTextQuestionIds = openTextQuestionsWithInsights.map((question) => question.id);

    if (openTextQuestionIds.length === 0) {
      return;
    }

    // Fetching responses
    const batchSize = 200;
    let skip = 0;

    const totalResponseCount = await prisma.response.count({
      where: {
        surveyId,
        documents: {
          none: {},
        },
        finished: true,
      },
    });

    const pages = Math.ceil(totalResponseCount / batchSize);

    for (let i = 0; i < pages; i++) {
      const responses = await prisma.response.findMany({
        where: {
          surveyId,
          documents: {
            none: {},
          },
          finished: true,
        },
        select: {
          id: true,
          data: true,
        },
        take: batchSize,
        skip,
      });

      const responsesWithOpenTextAnswers = responses.filter((response) =>
        doesResponseHasAnyOpenTextAnswer(openTextQuestionIds, response.data)
      );

      skip += batchSize - responsesWithOpenTextAnswers.length;

      const createDocumentPromises = responsesWithOpenTextAnswers.map((response) => {
        return Promise.all(
          openTextQuestionsWithInsights.map(async (question) => {
            const responseText = response.data[question.id] as string;
            if (!responseText) {
              return;
            }

            const text = getPromptText(question.headline.default, responseText);

            return await createDocument(name, {
              environmentId,
              surveyId,
              responseId: response.id,
              questionId: question.id,
              text,
            });
          })
        );
      });

      const createDocumentResults = await Promise.all(createDocumentPromises);
      const createdDocuments = createDocumentResults.flat().filter(Boolean);

      for (const document of createdDocuments) {
        if (document) {
          const insightPromises: Promise<void>[] = [];
          const { insights, isSpam, id, environmentId } = document;
          if (!isSpam) {
            for (const insight of insights) {
              if (typeof insight.title !== "string" || typeof insight.description !== "string") {
                throw new Error("Insight title and description must be a string");
              }

              // create or connect the insight
              insightPromises.push(handleInsightAssignments(environmentId, id, insight));
            }
            await Promise.all(insightPromises);
          }
        }
      }
      documentCache.revalidate({
        environmentId: environmentId,
        surveyId: surveyId,
      });
    }
    return;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getQuestionResponseReferenceId = (surveyId: string, questionId: TSurveyQuestionId) => {
  return `${surveyId}-${questionId}`;
};

export const createInsight = async (insightGroupInput: TInsightCreateInput): Promise<TInsight> => {
  validateInputs([insightGroupInput, ZInsightCreateInput]);

  try {
    // create document
    const { vector, ...data } = insightGroupInput;
    const prismaInsight = await prisma.insight.create({
      data,
    });

    const insight = {
      ...prismaInsight,
      _count: {
        documentInsights: 0,
      },
    };

    // update document vector with the embedding
    const vectorString = `[${insightGroupInput.vector.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE "Insight"
      SET "vector" = ${vectorString}::vector(512)
      WHERE "id" = ${insight.id};
    `;

    insightCache.revalidate({
      id: insight.id,
      environmentId: insight.environmentId,
    });

    return insight;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const handleInsightAssignments = async (
  environmentId: string,
  documentId: string,
  insight: {
    title: string;
    description: string;
    category: TInsightCategory;
  }
) => {
  // create embedding for insight
  const { embedding } = await embed({
    model: embeddingsModel,
    value: getInsightVectorText(insight.title, insight.description),
    experimental_telemetry: { isEnabled: true },
  });
  // find close insight to merge it with
  const nearestInsights = await findNearestInsights(environmentId, embedding, 1, 0.2);

  if (nearestInsights.length > 0) {
    // create a documentInsight with this insight
    await prisma.documentInsight.create({
      data: {
        documentId,
        insightId: nearestInsights[0].id,
      },
    });
    documentCache.revalidate({
      insightId: nearestInsights[0].id,
    });
  } else {
    // create new insight and documentInsight
    const newInsight = await createInsight({
      environmentId: environmentId,
      title: insight.title,
      description: insight.description,
      category: insight.category ?? "other",
      vector: embedding,
    });
    // create a documentInsight with this insight
    await prisma.documentInsight.create({
      data: {
        documentId,
        insightId: newInsight.id,
      },
    });
    documentCache.revalidate({
      insightId: newInsight.id,
    });
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
  const insights: TInsight[] = await prisma.$queryRaw`
    SELECT
      id,
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      title,
      description,
      category,
      "environmentId"
    FROM "Insight" d
    WHERE d."environmentId" = ${environmentId}
      AND d."vector" <=> ${vectorString}::vector(512) <= ${threshold}
    ORDER BY d."vector" <=> ${vectorString}::vector(512)
    LIMIT ${limit};
  `;

  return insights;
};

export const getInsightVectorText = (title: string, description: string): string =>
  `${title}: ${description}`;
