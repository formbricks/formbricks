"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromContactId,
  getOrganizationIdFromEnvironmentId,
  getProjectIdFromContactId,
  getProjectIdFromEnvironmentId,
} from "@/lib/utils/helper";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { getSurveys } from "@/modules/survey/list/lib/survey";

const ZGetPublishedLinkSurveysAction = z.object({
  environmentId: ZId,
});

export const getPublishedLinkSurveysAction = authenticatedActionClient
  .schema(ZGetPublishedLinkSurveysAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    const surveys = await getSurveys(parsedInput.environmentId);

    const publishedLinkSurveys = surveys.filter(
      (survey) => survey.status === "inProgress" && survey.type === "link"
    );

    return publishedLinkSurveys;
  });

const ZGeneratePersonalSurveyLinkAction = z.object({
  contactId: ZId,
  surveyId: ZId,
  expirationDays: z.number().optional(),
});

export const generatePersonalSurveyLinkAction = authenticatedActionClient
  .schema(ZGeneratePersonalSurveyLinkAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromContactId(parsedInput.contactId);
    const projectId = await getProjectIdFromContactId(parsedInput.contactId);

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
          minPermission: "readWrite",
          projectId,
        },
      ],
    });

    const result = await getContactSurveyLink(
      parsedInput.contactId,
      parsedInput.surveyId,
      parsedInput.expirationDays
    );

    if (!result.ok) {
      if (result.error.type === "not_found") {
        throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
      }
      if (result.error.type === "bad_request") {
        const errorMessage = result.error.details?.[0]?.issue || "Invalid request";
        throw new InvalidInputError(errorMessage);
      }
      const errorMessage = result.error.details?.[0]?.issue || "Failed to generate personal survey link";
      throw new InvalidInputError(errorMessage);
    }

    return {
      surveyUrl: result.data,
    };
  });
