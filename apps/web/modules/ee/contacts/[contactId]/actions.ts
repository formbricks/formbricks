"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
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
  .action(async ({ parsedInput }) => {
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
        const errorMessage = result.error.details?.[0]?.issue || "Invalid request";
        throw new InvalidInputError(errorMessage);
      }
      // For other error types, throw a generic error
      const errorMessage = result.error.details?.[0]?.issue || "Failed to generate personal survey link";
      throw new Error(errorMessage);
    }

    return {
      surveyUrl: result.data,
    };
  });
