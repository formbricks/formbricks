import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { authenticatedApiClient } from "@/modules/api/v2/management/auth/authenticated-api-client";
import { checkAuthorization } from "@/modules/api/v2/management/auth/check-authorization";
import { getEnvironmentId } from "@/modules/api/v2/management/lib/helper";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";

const ZContactLinkParams = z.object({
  surveyId: ZId,
  contactId: ZId,
});

export const GET = async (
  request: Request,
  props: { params: Promise<{ surveyId: string; contactId: string }> }
) =>
  authenticatedApiClient({
    request,
    externalParams: props.params,
    schemas: {
      params: ZContactLinkParams,
    },
    handler: async ({ authentication, parsedInput }) => {
      const { params } = parsedInput;

      if (!params) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "params", issue: "missing" }],
        });
      }

      const environmentIdResult = await getEnvironmentId(params.surveyId, false);

      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      const environmentId = environmentIdResult.data;

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId,
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(request, checkAuthorizationResult.error);
      }

      const survey = await prisma.survey.findUnique({
        where: {
          id: params.surveyId,
          environmentId,
        },
        select: {
          type: true,
        },
      });

      if (!survey) {
        return handleApiError(request, {
          type: "not_found",
          details: [{ field: "surveyId", issue: "not_found" }],
        });
      }

      if (survey.type !== "link") {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "surveyId", issue: "not_a_link_survey" }],
        });
      }

      // Check if contact exists and belongs to the environment
      const contact = await prisma.contact.findUnique({
        where: {
          id: params.contactId,
          environmentId,
        },
      });

      if (!contact) {
        return handleApiError(request, {
          type: "not_found",
          details: [{ field: "contactId", issue: "not_found" }],
        });
      }

      // Check if contact has already responded to this survey
      const existingResponse = await prisma.response.findFirst({
        where: {
          surveyId: params.surveyId,
          contactId: params.contactId,
        },
      });

      if (existingResponse) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "contactId", issue: "already_responded" }],
        });
      }

      const surveyUrl = getContactSurveyLink(params.contactId, params.surveyId, 7);

      return responses.successResponse({ data: { surveyUrl } });
    },
  });
