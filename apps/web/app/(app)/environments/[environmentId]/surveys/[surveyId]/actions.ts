"use server";

import { getOrganization } from "@/lib/organization/service";
import { getResponseDownloadUrl, getResponseFilteringValues } from "@/lib/response/service";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import { getTagsByEnvironmentId } from "@/lib/tag/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromSurveyId, getProjectIdFromSurveyId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { checkMultiLanguagePermission } from "@/modules/ee/multi-language-surveys/lib/actions";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { checkSpamProtectionPermission } from "@/modules/survey/lib/permission";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";
import { TSurvey, ZSurvey } from "@formbricks/types/surveys/types";

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

  const isSurveyFollowUpsEnabled = await getSurveyFollowUpsPermission(organization.billing.plan);
  if (!isSurveyFollowUpsEnabled) {
    throw new OperationNotAllowedError("Survey follow ups are not enabled for this organization");
  }
};

export const updateSurveyAction = authenticatedActionClient.schema(ZSurvey).action(
  withAuditLogging(
    "updated",
    "survey",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: TSurvey }) => {
      const organizationId = await getOrganizationIdFromSurveyId(parsedInput.id);
      await checkAuthorizationUpdated({
        userId: ctx.user?.id ?? "",
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

      const oldSurvey = await getSurvey(parsedInput.id);

      if (parsedInput.recaptcha?.enabled) {
        await checkSpamProtectionPermission(organizationId);
      }

      if (followUps?.length) {
        await checkSurveyFollowUpsPermission(organizationId);
      }

      if (parsedInput.languages?.length) {
        await checkMultiLanguagePermission(organizationId);
      }

      // Context for audit log
      ctx.auditLoggingCtx.surveyId = parsedInput.id;
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.oldObject = oldSurvey;

      const newSurvey = await updateSurvey(parsedInput);

      ctx.auditLoggingCtx.newObject = newSurvey;

      return newSurvey;
    }
  )
);
