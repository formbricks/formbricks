import { documentCache } from "@/lib/cache/document";
import { insightCache } from "@/lib/cache/insight";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { DOCUMENTS_PER_PAGE } from "@formbricks/lib/constants";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import {
  TDocument,
  TDocumentFilterCriteria,
  ZDocument,
  ZDocumentFilterCriteria,
} from "@formbricks/types/documents";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurveyQuestionId, ZSurveyQuestionId } from "@formbricks/types/surveys/types";

export const getDocumentsByInsightId = reactCache(
  async (
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
  async (
    insightId: string,
    surveyId: string,
    questionId: TSurveyQuestionId,
    limit?: number,
    offset?: number
  ): Promise<TDocument[]> =>
    cache(
      async () => {
        validateInputs(
          [insightId, ZId],
          [surveyId, ZId],
          [questionId, ZSurveyQuestionId],
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
          documentCache.tag.byInsightId(insightId),
          insightCache.tag.byId(insightId),
        ],
      }
    )()
);

export const getDocument = reactCache(
  async (documentId: string): Promise<TDocument | null> =>
    cache(
      async () => {
        validateInputs([documentId, ZId]);

        try {
          const document = await prisma.document.findUnique({
            where: {
              id: documentId,
            },
          });

          return document;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getDocumentById-${documentId}`],
      {
        tags: [documentCache.tag.byId(documentId)],
      }
    )()
);

export const updateDocument = async (documentId: string, data: Partial<TDocument>): Promise<void> => {
  validateInputs([documentId, ZId], [data, ZDocument.partial()]);
  try {
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data,
      select: {
        environmentId: true,
        documentInsights: {
          select: {
            insightId: true,
          },
        },
      },
    });

    documentCache.revalidate({ environmentId: updatedDocument.environmentId });

    for (const { insightId } of updatedDocument.documentInsights) {
      documentCache.revalidate({ insightId });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
