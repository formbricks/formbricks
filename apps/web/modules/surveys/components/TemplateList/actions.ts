"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProductIdFromEnvironmentId } from "@/lib/utils/helper";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { createSurvey } from "@formbricks/lib/survey/service";
import { ZId } from "@formbricks/types/common";
import { ZSurveyCreateInput } from "@formbricks/types/surveys/types";

const ZCreateSurveyAction = z.object({
  environmentId: ZId,
  surveyBody: ZSurveyCreateInput,
});

export const createSurveyAction = authenticatedActionClient
  .schema(ZCreateSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          rules: ["survey", "create"],
        },
        {
          type: "product",
          minPermission: "readWrite",
          productId: await getProductIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return await createSurvey(parsedInput.environmentId, parsedInput.surveyBody);
  });