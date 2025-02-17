"use server";

import { generateInsightsForSurvey } from "@/app/api/(internal)/insights/lib/utils";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromSurveyId, getProjectIdFromSurveyId } from "@/lib/utils/helper";
import { getIsAIEnabled, getIsOrganizationAIReady } from "@/modules/ee/license-check/lib/utils";
import { z } from "zod";
import { getOrganization, updateOrganization } from "@formbricks/lib/organization/service";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZOrganizationUpdateInput } from "@formbricks/types/organizations";

export const checkAIPermission = async (organizationId: string) => {
  const organization = await getOrganization(organizationId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const isAIEnabled = await getIsAIEnabled({
    isAIEnabled: organization.isAIEnabled,
    billing: organization.billing,
  });

  if (!isAIEnabled) {
    throw new OperationNotAllowedError("AI is not enabled for this organization");
  }
};

const ZGenerateInsightsForSurveyAction = z.object({
  surveyId: ZId,
});

export const generateInsightsForSurveyAction = authenticatedActionClient
  .schema(ZGenerateInsightsForSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          schema: ZGenerateInsightsForSurveyAction,
          data: parsedInput,
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    await checkAIPermission(organizationId);
    generateInsightsForSurvey(parsedInput.surveyId);
  });

const ZUpdateOrganizationAIEnabledAction = z.object({
  organizationId: ZId,
  data: ZOrganizationUpdateInput.pick({ isAIEnabled: true }),
});

export const updateOrganizationAIEnabledAction = authenticatedActionClient
  .schema(ZUpdateOrganizationAIEnabledAction)
  .action(async ({ parsedInput, ctx }) => {
    const organizationId = parsedInput.organizationId;

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          schema: ZOrganizationUpdateInput.pick({ isAIEnabled: true }),
          data: parsedInput.data,
          roles: ["owner", "manager"],
        },
      ],
    });

    const organization = await getOrganization(organizationId);

    if (!organization) {
      throw new Error("Organization not found");
    }

    const isOrganizationAIReady = await getIsOrganizationAIReady(organization.billing.plan);

    if (!isOrganizationAIReady) {
      throw new OperationNotAllowedError("AI is not ready for this organization");
    }

    return await updateOrganization(parsedInput.organizationId, parsedInput.data);
  });
