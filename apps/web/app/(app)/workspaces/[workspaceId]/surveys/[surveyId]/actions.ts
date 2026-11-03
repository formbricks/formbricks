"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { getResponseFilteringValues } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getTagsByWorkspaceId } from "@/lib/tag/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";

const ZGetSurveyFilterDataAction = z.object({
  surveyId: ZId,
});

export const getSurveyFilterDataAction = authenticatedActionClient
  .inputSchema(ZGetSurveyFilterDataAction)
  .action(async ({ ctx, parsedInput }) => {
    // Authorized first: the resolver denies an unknown id too, so a forbidden survey and a missing one
    // answer alike (ENG-3282) instead of "not found" confirming which ids exist.
    await assertCan({ type: "user", id: ctx.user.id }, "survey.response_read", {
      type: "survey",
      id: parsedInput.surveyId,
    });

    const survey = await getSurvey(parsedInput.surveyId);

    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);

    const organizationBilling = await getOrganizationBilling(organizationId);
    if (!organizationBilling) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    const isQuotasAllowed = await getIsQuotasEnabled(organizationId);

    const [
      tags,
      { contactAttributes: attributes, meta, hiddenFields, reservedValues, variableValues },
      quotas = [],
    ] = await Promise.all([
      getTagsByWorkspaceId(survey.workspaceId),
      getResponseFilteringValues(parsedInput.surveyId),
      isQuotasAllowed ? getQuotas(parsedInput.surveyId) : [],
    ]);

    return { environmentTags: tags, attributes, meta, hiddenFields, reservedValues, variableValues, quotas };
  });
