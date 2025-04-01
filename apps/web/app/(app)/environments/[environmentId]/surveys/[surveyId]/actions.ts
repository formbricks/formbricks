"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromSurveyId, getProjectIdFromSurveyId } from "@/lib/utils/helper";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { z } from "zod";
import { getOrganization } from "@formbricks/lib/organization/service";
import { getResponseDownloadUrl, getResponseFilteringValues } from "@formbricks/lib/response/service";
import { getSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";
import { ZSurvey } from "@formbricks/types/surveys/types";

const ZGetResponsesDownloadUrlAction = z.object({
  surveyId: ZId,
  format: z.union([z.literal("csv"), z.literal("xlsx")]),
  filterCriteria: ZResponseFilterCriteria,
});

export const getResponsesDownloadUrlAction = authenticatedActionClient
  .schema(ZGetResponsesDownloadUrlAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
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

    return getResponseDownloadUrl(parsedInput.surveyId, parsedInput.format, parsedInput.filterCriteria);
  });

const ZGetSurveyFilterDataAction = z.object({
  surveyId: ZId,
});

export const getSurveyFilterDataAction = authenticatedActionClient
  .schema(ZGetSurveyFilterDataAction)
  .action(async ({ ctx, parsedInput }) => {
    const survey = await getSurvey(parsedInput.surveyId);

    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
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

    const [tags, { contactAttributes: attributes, meta, hiddenFields }] = await Promise.all([
      getTagsByEnvironmentId(survey.environmentId),
      getResponseFilteringValues(parsedInput.surveyId),
    ]);

    return { environmentTags: tags, attributes, meta, hiddenFields };
  });

/**
 * Checks if survey follow-ups are enabled for the given organization.
 *
 * @param {string} organizationId  The ID of the organization to check.
 * @returns {Promise<void>}  A promise that resolves if the permission is granted.
 * @throws {ResourceNotFoundError}  If the organization is not found.
 * @throws {OperationNotAllowedError}  If survey follow-ups are not enabled for the organization.
 */
const checkSurveyFollowUpsPermission = async (organizationId: string): Promise<void> => {
  const organization = await getOrganization(organizationId);

  if (!organization) {
    throw new ResourceNotFoundError("Organization not found", organizationId);
  }

  const isSurveyFollowUpsEnabled = getSurveyFollowUpsPermission(organization.billing.plan);
  if (!isSurveyFollowUpsEnabled) {
    throw new OperationNotAllowedError("Survey follow ups are not enabled for this organization");
  }
};

export const updateSurveyAction = authenticatedActionClient
  .schema(ZSurvey)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.id);
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
          projectId: await getProjectIdFromSurveyId(parsedInput.id),
          minPermission: "readWrite",
        },
      ],
    });

    const { followUps } = parsedInput;

    if (followUps?.length) {
      await checkSurveyFollowUpsPermission(organizationId);
    }

    return await updateSurvey(parsedInput);
  });
