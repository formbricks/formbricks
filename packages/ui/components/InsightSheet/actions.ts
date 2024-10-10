"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import {
  getDocumentsByInsightId,
  getDocumentsByInsightIdSurveyIdQuestionId,
} from "@formbricks/lib/document/service";
import { getOrganizationIdFromInsightId } from "@formbricks/lib/organization/utils";
import { ZId } from "@formbricks/types/common";

const ZGetDocumentsByInsightIdSurveyIdQuestionIdAction = z.object({
  insightId: ZId,
  surveyId: ZId,
  questionId: ZId,
});

export const getDocumentsByInsightIdSurveyIdQuestionIdAction = authenticatedActionClient
  .schema(ZGetDocumentsByInsightIdSurveyIdQuestionIdAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromInsightId(parsedInput.insightId),
      rules: ["response", "read"],
    });

    return await getDocumentsByInsightIdSurveyIdQuestionId(
      parsedInput.insightId,
      parsedInput.surveyId,
      parsedInput.questionId
    );
  });

const ZGetDocumentsByInsightIdAction = z.object({
  insightId: ZId,
});

export const getDocumentsByInsightIdAction = authenticatedActionClient
  .schema(ZGetDocumentsByInsightIdAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromInsightId(parsedInput.insightId),
      rules: ["response", "read"],
    });

    return await getDocumentsByInsightId(parsedInput.insightId);
  });
