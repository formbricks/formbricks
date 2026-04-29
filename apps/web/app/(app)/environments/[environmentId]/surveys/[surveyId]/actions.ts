"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";
import { capturePostHogEvent } from "@/lib/posthog";
import { getResponseDownloadFile, getResponseFilteringValues } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getTagsByEnvironmentId } from "@/lib/tag/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromSurveyId, getProjectIdFromSurveyId } from "@/lib/utils/helper";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";

const ZGetResponsesDownloadUrlAction = z.object({
  surveyId: ZId,
  format: z.union([z.literal("csv"), z.literal("xlsx")]),
  filterCriteria: ZResponseFilterCriteria,
});

export const getResponsesDownloadUrlAction = authenticatedActionClient
  .inputSchema(ZGetResponsesDownloadUrlAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);

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
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    const projectId = await getProjectIdFromSurveyId(parsedInput.surveyId);
    const result = await getResponseDownloadFile(
      parsedInput.surveyId,
      parsedInput.format,
      parsedInput.filterCriteria
    );

    capturePostHogEvent(
      ctx.user.id,
      "responses_exported",
      {
        survey_id: parsedInput.surveyId,
        format: parsedInput.format,
        filter_applied: Object.keys(parsedInput.filterCriteria ?? {}).length > 0,
        organization_id: organizationId,
        workspace_id: projectId,
      },
      { organizationId, workspaceId: projectId }
    );

    return result;
  });

const ZGetSurveyFilterDataAction = z.object({
  surveyId: ZId,
});

export const getSurveyFilterDataAction = authenticatedActionClient
  .inputSchema(ZGetSurveyFilterDataAction)
  .action(async ({ ctx, parsedInput }) => {
    const survey = await getSurvey(parsedInput.surveyId);

    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    const organizationBilling = await getOrganizationBilling(organizationId);
    if (!organizationBilling) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    const isQuotasAllowed = await getIsQuotasEnabled(organizationId);

    const [tags, { contactAttributes: attributes, meta, hiddenFields }, quotas = []] = await Promise.all([
      getTagsByEnvironmentId(survey.environmentId),
      getResponseFilteringValues(parsedInput.surveyId),
      isQuotasAllowed ? getQuotas(parsedInput.surveyId) : [],
    ]);

    return { environmentTags: tags, attributes, meta, hiddenFields, quotas };
  });
