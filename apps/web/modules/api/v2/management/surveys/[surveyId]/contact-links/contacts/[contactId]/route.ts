import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getEnvironmentId } from "@/modules/api/v2/management/lib/helper";
import { getContact } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/contacts/[contactId]/lib/contacts";
import { getResponse } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/contacts/[contactId]/lib/response";
import { getSurvey } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/contacts/[contactId]/lib/surveys";
import {
  TContactLinkParams,
  ZContactLinkParams,
} from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/contacts/[contactId]/types/survey";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

export const GET = async (request: Request, props: { params: Promise<TContactLinkParams> }) =>
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

      if (!hasPermission(authentication.environmentPermissions, environmentId, "GET")) {
        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      const surveyResult = await getSurvey(params.surveyId);

      if (!surveyResult.ok) {
        return handleApiError(request, surveyResult.error);
      }

      const survey = surveyResult.data;

      if (!survey) {
        return handleApiError(request, {
          type: "not_found",
          details: [{ field: "surveyId", issue: "Not found" }],
        });
      }

      if (survey.type !== "link") {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "surveyId", issue: "Not a link survey" }],
        });
      }

      // Check if contact exists and belongs to the environment
      const contactResult = await getContact(params.contactId, environmentId);

      if (!contactResult.ok) {
        return handleApiError(request, contactResult.error);
      }

      const contact = contactResult.data;

      if (!contact) {
        return handleApiError(request, {
          type: "not_found",
          details: [{ field: "contactId", issue: "Not found" }],
        });
      }

      // Check if contact has already responded to this survey
      const existingResponseResult = await getResponse(params.contactId, params.surveyId);

      if (existingResponseResult.ok) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "contactId", issue: "Already responded" }],
        });
      }

      const surveyUrlResult = getContactSurveyLink(params.contactId, params.surveyId, 7);

      if (!surveyUrlResult.ok) {
        return handleApiError(request, surveyUrlResult.error);
      }

      return responses.successResponse({ data: { surveyUrl: surveyUrlResult.data } });
    },
  });
