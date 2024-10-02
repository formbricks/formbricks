"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getDocumentsByInsightIdSurveyIdQuestionId } from "@formbricks/lib/document/service";
import { getOrganizationIdFromInsightId } from "@formbricks/lib/organization/utils";
import { ZId } from "@formbricks/types/common";

const ZGetDocumentsByInsightIdAction = z.object({
  insightId: ZId,
  surveyId: ZId,
  questionId: ZId,
});

export const getDocumentsByInsightIdSurveyIdQuestionIdAction = authenticatedActionClient
  .schema(ZGetDocumentsByInsightIdAction)
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
