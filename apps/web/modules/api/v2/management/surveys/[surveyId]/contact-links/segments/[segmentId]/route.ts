import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { authenticatedApiClient } from "@/modules/api/v2/management/auth/authenticated-api-client";
import { checkAuthorization } from "@/modules/api/v2/management/auth/check-authorization";
import { getEnvironmentId } from "@/modules/api/v2/management/lib/helper";
import { getContactsInSegment } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/contact";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { z } from "zod";
import { logger } from "@formbricks/logger";

const ZContactLinksBySegmentParams = z.object({
  surveyId: z.string().cuid2(),
  segmentId: z.string().cuid2(),
});

const ZContactLinksBySegmentQuery = z.object({
  expirationDays: z.coerce.number().positive().min(1).max(365).nullable().default(null).optional(),
  limit: z.coerce.number().min(1).max(10).optional().default(10),
  skip: z.coerce.number().min(0).optional().default(0),
});

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
              {
                error: surveyUrlResult.error,
                contactId: contact.id,
                surveyId: params.surveyId,
              },
              "Failed to generate survey URL for contact"
            );
            return null;
          }

          // Calculate expiration date based on expirationDays
          let expiresAt: string | null = null;
          if (query?.expirationDays) {
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + query.expirationDays);
            expiresAt = expirationDate.toISOString();
          }

          return {
            contactId: contact.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            surveyUrl: surveyUrlResult.data,
            expiresAt,
          };
        })
        .filter(Boolean); // Remove any failed URL generations

      return responses.successResponse({
        data: contactLinks,
        meta,
      });
    },
  });
