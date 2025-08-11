import { responses } from "@/app/lib/api/response";
import { TApiKeyAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { DatabaseError } from "@formbricks/types/errors";
import { getContactAttributes } from "./lib/contact-attributes";

export const GET = withV1ApiWrapper({
  handler: async ({ authentication }: { authentication: NonNullable<TApiKeyAuthentication> }) => {
    try {
      const isContactsEnabled = await getIsContactsEnabled();
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "Contacts are only enabled for Enterprise Edition, please upgrade."
          ),
        };
      }

      const environmentIds = authentication.environmentPermissions.map(
        (permission) => permission.environmentId
      );

      const attributes = await getContactAttributes(environmentIds);
      return {
        response: responses.successResponse(attributes),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        return {
          response: responses.badRequestResponse(error.message),
        };
      }
      throw error;
    }
  },
});
