import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { authenticatedApiClient } from "@/modules/api/v2/management/auth/authenticated-api-client";
import { checkAuthorization } from "@/modules/api/v2/management/auth/check-authorization";
import { getEnvironmentId } from "@/modules/api/v2/management/lib/helper";
import { getContactsInSegment } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/contact";
import {
  ZContactLinksBySegmentParams,
  ZContactLinksBySegmentQuery,
} from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/types/contact";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { logger } from "@formbricks/logger";

export const GET = async (
  request: Request,
  props: { params: Promise<{ surveyId: string; segmentId: string }> }
) =>
  authenticatedApiClient({
    request,
    externalParams: props.params,
    schemas: {
      params: ZContactLinksBySegmentParams,
      query: ZContactLinksBySegmentQuery,
    },
    handler: async ({ authentication, parsedInput }) => {
      const { params, query } = parsedInput;

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

      // Get contacts based on segment
      const contactsResult = await getContactsInSegment(
        params.surveyId,
        params.segmentId,
        query?.limit || 10,
        query?.skip || 0
      );

      if (!contactsResult.ok) {
        return handleApiError(request, contactsResult.error);
      }

      const { data: contacts, meta } = contactsResult.data;

      // Calculate expiration date based on expirationDays
      let expiresAt: string | null = null;
      if (query?.expirationDays) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + query.expirationDays);
        expiresAt = expirationDate.toISOString();
      }

      // Generate survey links for each contact
      const contactLinks = contacts
        .map((contact) => {
          const surveyUrlResult = getContactSurveyLink(
            contact.id,
            params.surveyId,
            query?.expirationDays || undefined
          );

          if (!surveyUrlResult.ok) {
            logger.error(
              { error: surveyUrlResult.error, contactId: contact.id, surveyId: params.surveyId },
              "Failed to generate survey URL for contact"
            );
            return null;
          }

          const { id, ...attributes } = contact;

          return {
            contactId: id,
            ...attributes,
            surveyUrl: surveyUrlResult.data,
            expiresAt,
          };
        })
        .filter(Boolean);

      return responses.successResponse({
        data: contactLinks,
        meta,
      });
    },
  });
