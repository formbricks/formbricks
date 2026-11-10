import "server-only";
import { ValidationError } from "@formbricks/types/errors";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import { problemForbidden, problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { convertToCsv } from "@/lib/utils/file-conversion";
import { getOrganizationIdFromSurveyId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { generatePersonalLinks } from "@/modules/ee/contacts/lib/contacts";
import { NO_CONTACTS_IN_SEGMENT_ERROR_CODE } from "@/modules/ee/contacts/lib/personal-link-errors";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TSurveyPersonalLinksBody } from "../schemas";
import type { TSurveyPersonalLinksResource } from "../serializers";

const CSV_HEADERS = ["Formbricks Contact ID", "User ID", "First Name", "Last Name", "Email", "Personal Link"];

/**
 * `POST /api/internal/surveys/{surveyId}/personal-links`: a personal link to the survey for every contact
 * in a segment, as a CSV file, the share modal's Personal links tab. The checks of the server action it
 * replaces, in its order: the Contacts licence (403 with the reason), then `survey.write` on the survey.
 * The segment is evaluated with the caller's survey visibility (ENG-6870).
 *
 * The refusals the tab translates answer 422 with their error code as the detail: a segment from another
 * workspace, one whose filters read a survey the caller can't see, and one with no contacts. Not audited;
 * PostHog records `personal_link_created` with the link count, as before.
 */
export async function generatePersonalLinksOperation({
  authentication,
  surveyId,
  body,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  surveyId: string;
  body: TSurveyPersonalLinksBody;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  // Each throws `ResourceNotFoundError` for an unknown survey: the wrapper's uniform 403.
  const organizationId = await getOrganizationIdFromSurveyId(surveyId);
  const workspaceId = await getWorkspaceIdFromSurveyId(surveyId);
  if (!(await getIsContactsEnabled(organizationId))) {
    return problemForbidden(requestId, "Contacts are not enabled for this workspace", instance);
  }

  const access = await requireSurveyActionAccess({
    authentication,
    surveyId,
    action: "survey.write",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  let contactsResult: Awaited<ReturnType<typeof generatePersonalLinks>>;
  try {
    contactsResult = await generatePersonalLinks(
      surveyId,
      body.segmentId,
      await resolveSurveyActorContext({ type: "user", id: access.userId }, organizationId),
      body.expirationDays
    );
  } catch (error) {
    // The segment is in another workspace, or its filters read a survey the caller can't see.
    if (error instanceof ValidationError) {
      return problemUnprocessableContent(requestId, error.message, { instance });
    }
    throw error;
  }

  if (!contactsResult || contactsResult.length === 0) {
    return problemUnprocessableContent(requestId, NO_CONTACTS_IN_SEGMENT_ERROR_CODE, { instance });
  }

  capturePostHogEvent(
    access.userId,
    "personal_link_created",
    {
      organization_id: organizationId,
      workspace_id: workspaceId,
      survey_id: surveyId,
      link_count: contactsResult.length,
    },
    { organizationId, workspaceId }
  );

  const csvData = contactsResult
    .map((contact) => {
      if (!contact) return null;
      const attributes = contact.attributes ?? {};
      return {
        "Formbricks Contact ID": contact.contactId,
        "User ID": attributes.userId ?? "",
        "First Name": attributes.firstName ?? "",
        "Last Name": attributes.lastName ?? "",
        Email: attributes.email ?? "",
        "Personal Link": contact.surveyUrl,
      };
    })
    .filter((contact) => contact !== null);

  const resource: TSurveyPersonalLinksResource = {
    fileName: `personal-links-${surveyId}-${Date.now()}.csv`,
    csvContent: await convertToCsv(CSV_HEADERS, csvData),
  };
  return successResponse(resource, { requestId });
}
