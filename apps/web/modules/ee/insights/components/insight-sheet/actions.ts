"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getEnvironmentIdFromInsightId,
  getEnvironmentIdFromSurveyId,
  getOrganizationIdFromDocumentId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromInsightId,
  getProjectIdFromDocumentId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromInsightId,
} from "@/lib/utils/helper";
import { checkAIPermission } from "@/modules/ee/insights/actions";
import {
  getDocumentsByInsightId,
  getDocumentsByInsightIdSurveyIdQuestionId,
} from "@/modules/ee/insights/components/insight-sheet/lib/documents";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZDocumentFilterCriteria } from "@formbricks/types/documents";
import { ZSurveyQuestionId } from "@formbricks/types/surveys/types";
import { updateDocument } from "./lib/documents";

const ZGetDocumentsByInsightIdSurveyIdQuestionIdAction = z.object({
  insightId: ZId,
  surveyId: ZId,
  questionId: ZSurveyQuestionId,
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export const getDocumentsByInsightIdSurveyIdQuestionIdAction = authenticatedActionClient
  .schema(ZGetDocumentsByInsightIdSurveyIdQuestionIdAction)
  .action(async ({ ctx, parsedInput }) => {
    const insightEnvironmentId = await getEnvironmentIdFromInsightId(parsedInput.insightId);
    const surveyEnvironmentId = await getEnvironmentIdFromSurveyId(parsedInput.surveyId);

    if (insightEnvironmentId !== surveyEnvironmentId) {
      throw new Error("Insight and survey are not in the same environment");
    }

    const organizationId = await getOrganizationIdFromEnvironmentId(surveyEnvironmentId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromEnvironmentId(surveyEnvironmentId),
        },
      ],
    });

    await checkAIPermission(organizationId);

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
    const organizationId = await getOrganizationIdFromInsightId(parsedInput.insightId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromInsightId(parsedInput.insightId),
        },
      ],
    });

    await checkAIPermission(organizationId);

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
    const organizationId = await getOrganizationIdFromDocumentId(parsedInput.documentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromDocumentId(parsedInput.documentId),
        },
      ],
    });

    await checkAIPermission(organizationId);

    return await updateDocument(parsedInput.documentId, parsedInput.data);
  });
