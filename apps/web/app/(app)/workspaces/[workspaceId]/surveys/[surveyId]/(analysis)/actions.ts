"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";
import { getDisplaysBySurveyIdWithContact } from "@/lib/display/service";
import { getResponseCountBySurveyId, getResponses } from "@/lib/response/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromSurveyId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { getSurveySummary } from "./summary/lib/surveySummary";

const ZRevalidateSurveyIdPathAction = z.object({
  workspaceId: ZId,
  surveyId: ZId,
});

export const revalidateSurveyIdPathAction = authenticatedActionClient
  .inputSchema(ZRevalidateSurveyIdPathAction)
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
          type: "workspaceTeam",
          minPermission: "read",
          workspaceId: parsedInput.workspaceId,
        },
      ],
    });

    revalidatePath(`/workspaces/${parsedInput.workspaceId}/surveys/${parsedInput.surveyId}`);
  });

const ZGetResponsesAction = z.object({
  surveyId: ZId,
  limit: z.number().optional(),
  offset: z.number().optional(),
  filterCriteria: ZResponseFilterCriteria.optional(),
});

export const getResponsesAction = authenticatedActionClient
  .inputSchema(ZGetResponsesAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          schema: ZResponseFilterCriteria,
          data: parsedInput.filterCriteria,
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "read",
          workspaceId: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return getResponses(
      parsedInput.surveyId,
      parsedInput.limit,
      parsedInput.offset,
      parsedInput.filterCriteria
    );
  });

const ZGetSurveySummaryAction = z.object({
  surveyId: ZId,
  filterCriteria: ZResponseFilterCriteria.optional(),
});

export const getSurveySummaryAction = authenticatedActionClient
  .inputSchema(ZGetSurveySummaryAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          schema: ZResponseFilterCriteria,
          data: parsedInput.filterCriteria,
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "read",
          workspaceId: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });
    return getSurveySummary(parsedInput.surveyId, parsedInput.filterCriteria);
  });

const ZGetResponseCountAction = z.object({
  surveyId: ZId,
  filterCriteria: ZResponseFilterCriteria.optional(),
});

export const getResponseCountAction = authenticatedActionClient
  .inputSchema(ZGetResponseCountAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          schema: ZResponseFilterCriteria,
          data: parsedInput.filterCriteria,
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "read",
          workspaceId: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return getResponseCountBySurveyId(parsedInput.surveyId, parsedInput.filterCriteria);
  });

const ZGetDisplaysWithContactAction = z.object({
  surveyId: ZId,
  limit: z.int().min(1).max(100),
  offset: z.int().nonnegative(),
});

export const getDisplaysWithContactAction = authenticatedActionClient
  .inputSchema(ZGetDisplaysWithContactAction)
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
          type: "workspaceTeam",
          minPermission: "read",
          workspaceId: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return getDisplaysBySurveyIdWithContact(parsedInput.surveyId, parsedInput.limit, parsedInput.offset);
  });
