import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getEnvironmentId } from "@/modules/api/v2/management/lib/helper";
import { getContactsInSegment } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/contact";
import {
  ZContactLinksBySegmentParams,
  ZContactLinksBySegmentQuery,
} from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/types/contact";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
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

      const isContactsEnabled = await getIsContactsEnabled();
      if (!isContactsEnabled) {
        return handleApiError(request, {
          type: "forbidden",
          details: [
            { field: "contacts", issue: "Contacts are only enabled for Enterprise Edition, please upgrade." },
          ],
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

      // Get contacts based on segment
      const contactsResult = await getContactsInSegment(
        params.surveyId,
        params.segmentId,
        query?.limit || 10,
        query?.skip || 0,
        query?.attributeKeys
      );

      if (!contactsResult.ok) {
        return handleApiError(request, contactsResult.error as ApiErrorResponseV2);
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
          const { contactId, attributes } = contact;

          const surveyUrlResult = getContactSurveyLink(
            contactId,
            params.surveyId,
            query?.expirationDays || undefined
          );

          if (!surveyUrlResult.ok) {
            logger.error(
              { error: surveyUrlResult.error, contactId: contactId, surveyId: params.surveyId },
              "Failed to generate survey URL for contact"
            );
            return null;
          }

          return {
            contactId,
            attributes,
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
