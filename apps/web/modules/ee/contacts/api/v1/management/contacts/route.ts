import { parseV1Pagination } from "@/app/api/v1/management/lib/pagination";
import { handleApiError } from "@/app/lib/api/handle-api-error";
import { responses } from "@/app/lib/api/response";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { requireWorkspaceContactDirectory } from "@/modules/ee/contacts/lib/contact-directory";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getContacts } from "./lib/contacts";

export const GET = withV1ApiWrapper({
  handler: async ({ req, authentication }) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      const isContactsEnabled = await getIsContactsEnabled(authentication.organizationId);
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "Contacts are only enabled for Enterprise Edition, please upgrade."
          ),
        };
      }

      const { limit, offset } = parseV1Pagination(req.nextUrl.searchParams);
      const workspaceIds = [
        ...new Set(authentication.workspacePermissions.map((permission) => permission.workspaceId)),
      ];

      // Decision 13: a key for one workspace with no contact directory gets the message, as the other
      // contact routes answer; a key for several lists what their directories hold.
      if (workspaceIds.length === 1) await requireWorkspaceContactDirectory(workspaceIds[0]);

      const contacts = await getContacts(workspaceIds, limit, offset);

      return {
        response: responses.successResponse(contacts),
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
});

// Please use the client API to create a new contact
