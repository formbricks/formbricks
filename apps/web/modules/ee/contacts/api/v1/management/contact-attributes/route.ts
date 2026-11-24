import { handleApiError } from "@/app/lib/api/handle-api-error";
import { responses } from "@/app/lib/api/response";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { requireWorkspaceContactDirectory } from "@/modules/ee/contacts/lib/contact-directory";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getContactAttributes } from "./lib/contact-attributes";

export const GET = withV1ApiWrapper({
  handler: async ({ authentication }: THandlerParams) => {
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

      const workspaceIds = [
        ...new Set(authentication.workspacePermissions.map((permission) => permission.workspaceId)),
      ];

      // Decision 13: a key for one workspace with no contact directory gets the message, as the other
      // contact routes answer; a key for several lists what their directories hold.
      if (workspaceIds.length === 1) await requireWorkspaceContactDirectory(workspaceIds[0]);

      const attributes = await getContactAttributes(workspaceIds);
      return {
        response: responses.successResponse(attributes),
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
});
