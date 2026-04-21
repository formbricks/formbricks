"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZSurveyInvitationConfig } from "@formbricks/types/surveys/types";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromSurveyId, getProjectIdFromSurveyId } from "@/lib/utils/helper";
import { getSurvey } from "@/modules/survey/lib/survey";
import { getInvitationSummary, sendInvitationsForSurvey } from "./lib/invitations";
import { sendManualReminders } from "./lib/reminders";

const ZSurveyIdInput = z.object({ surveyId: z.string().cuid2() });

export const getInvitationSummaryAction = authenticatedActionClient
  .schema(ZSurveyIdInput)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
          minPermission: "read",
        },
      ],
    });
    return getInvitationSummary(parsedInput.surveyId);
  });

const ZSendInvitationsInput = z.object({
  surveyId: z.string().cuid2(),
  config: ZSurveyInvitationConfig,
});

export const sendInvitationsAction = authenticatedActionClient
  .schema(ZSendInvitationsInput)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) throw new ResourceNotFoundError("Survey", parsedInput.surveyId);

    const org = await getOrganizationByEnvironmentId(survey.environmentId);
    const organizationName = org?.name ?? "";

    const result = await sendInvitationsForSurvey({
      surveyId: survey.id,
      environmentId: survey.environmentId,
      organizationName,
      surveyName: survey.name,
      config: parsedInput.config,
    });

    revalidatePath(`/environments/${survey.environmentId}/surveys/${survey.id}`);
    return result;
  });

const ZSendRemindersInput = z.object({
  surveyId: z.string().cuid2(),
  config: ZSurveyInvitationConfig,
  minDaysSinceLast: z.number().int().min(0).max(365).optional(),
});

export const sendRemindersAction = authenticatedActionClient
  .schema(ZSendRemindersInput)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) throw new ResourceNotFoundError("Survey", parsedInput.surveyId);

    const org = await getOrganizationByEnvironmentId(survey.environmentId);
    const organizationName = org?.name ?? "";

    const result = await sendManualReminders({
      surveyId: survey.id,
      organizationName,
      surveyName: survey.name,
      config: parsedInput.config,
      minDaysSinceLast: parsedInput.minDaysSinceLast,
    });

    revalidatePath(`/environments/${survey.environmentId}/surveys/${survey.id}`);
    return result;
  });
