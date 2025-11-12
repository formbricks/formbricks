"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { getSurveys } from "@/modules/survey/list/lib/survey";

const ZGetPublishedLinkSurveysAction = z.object({
  environmentId: z.string().cuid2(),
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

    // Filter for published link surveys (status: "inProgress", type: "link")
    const publishedLinkSurveys = surveys.filter(
      (survey) => survey.status === "inProgress" && survey.type === "link"
    );

    return publishedLinkSurveys;
  });

const ZGeneratePersonalSurveyLinkAction = z.object({
  contactId: z.string().cuid2(),
  surveyId: z.string().cuid2(),
  expirationDays: z.number().optional(),
});

export const generatePersonalSurveyLinkAction = authenticatedActionClient
  .schema(ZGeneratePersonalSurveyLinkAction)
  .action(async ({ ctx, parsedInput }) => {
    // Check if contact has already responded to this survey
    const existingResponse = await prisma.response.findFirst({
      where: {
        contactId: parsedInput.contactId,
        surveyId: parsedInput.surveyId,
      },
      select: {
        id: true,
      },
    });

    if (existingResponse) {
      throw new InvalidInputError("Contact has already responded to this survey");
    }

    // Authorization is handled by the getContactSurveyLink function internally
    // which checks survey and contact existence and permissions

    const result = await getContactSurveyLink(
      parsedInput.contactId,
      parsedInput.surveyId,
      parsedInput.expirationDays
    );

    if (!result.ok) {
      // Convert ApiErrorResponseV2 to appropriate error types
      if (result.error.type === "not_found") {
        throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
      }
      if (result.error.type === "bad_request") {
        throw new InvalidInputError(result.error.message || "Invalid request");
      }
      // For other error types, throw a generic error
      throw new Error(result.error.message || "Failed to generate personal survey link");
    }

    return {
      surveyUrl: result.data,
    };
  });
