"use server";

import { insightCache } from "@/lib/cache/insight";
import {
  getDocumentsByInsightId,
  getDocumentsByInsightIdSurveyIdQuestionId,
} from "@/modules/ee/insights/components/insight-sheet/lib/documents";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { cache } from "@formbricks/lib/cache";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { ZId } from "@formbricks/types/common";
import { ZDocumentFilterCriteria } from "@formbricks/types/documents";
import { ZSurveyQuestionId } from "@formbricks/types/surveys/types";
import { getDocument, updateDocument } from "./lib/documents";

const ZGetDocumentsByInsightIdSurveyIdQuestionIdAction = z.object({
  insightId: ZId,
  surveyId: ZId,
  questionId: ZSurveyQuestionId,
  limit: z.number().optional(),
  offset: z.number().optional(),
});

const getOrganizationIdFromInsightId = async (insightId: string) =>
  cache(
    async () => {
      const insight = await prisma.insight.findUnique({
        where: {
          id: insightId,
        },
        select: {
          environmentId: true,
        },
      });

      if (!insight) {
        throw new Error("Insight not found");
      }

      return await getOrganizationIdFromEnvironmentId(insight.environmentId);
    },
    [`getInsight-${insightId}`],
    {
      tags: [insightCache.tag.byId(insightId)],
    }
  )();

export const getDocumentsByInsightIdSurveyIdQuestionIdAction = authenticatedActionClient
  .schema(ZGetDocumentsByInsightIdSurveyIdQuestionIdAction)
  .action(async ({ ctx, parsedInput }) => {
    const insight = await getOrganizationIdFromInsightId(parsedInput.insightId);

    if (!insight) {
      throw new Error("Insight not found");
    }

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromInsightId(parsedInput.insightId),
      rules: ["response", "read"],
    });

    return await getDocumentsByInsightIdSurveyIdQuestionId(
      parsedInput.insightId,
      parsedInput.surveyId,
      parsedInput.questionId,
      parsedInput.limit,
      parsedInput.offset
    );
  });

const ZGetDocumentsByInsightIdAction = z.object({
  insightId: ZId,
  limit: z.number().optional(),
  offset: z.number().optional(),
  filterCriteria: ZDocumentFilterCriteria.optional(),
});

export const getDocumentsByInsightIdAction = authenticatedActionClient
  .schema(ZGetDocumentsByInsightIdAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromInsightId(parsedInput.insightId),
      rules: ["response", "read"],
    });

    return await getDocumentsByInsightId(
      parsedInput.insightId,
      parsedInput.limit,
      parsedInput.offset,
      parsedInput.filterCriteria
    );
  });

const ZUpdateDocumentAction = z.object({
  documentId: ZId,
  data: z
    .object({
      sentiment: z.enum(["positive", "negative", "neutral"]).optional(),
    })
    .strict(),
});

export const updateDocumentAction = authenticatedActionClient
  .schema(ZUpdateDocumentAction)
  .action(async ({ ctx, parsedInput }) => {
    const document = await getDocument(parsedInput.documentId);

    if (!document) {
      throw new Error("Document not found");
    }

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(document.environmentId),
      rules: ["response", "update"],
    });

    return await updateDocument(parsedInput.documentId, parsedInput.data);
  });
