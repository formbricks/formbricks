"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
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
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["survey", "create"],
    });

    return await createSurvey(parsedInput.environmentId, parsedInput.surveyBody);
  });
