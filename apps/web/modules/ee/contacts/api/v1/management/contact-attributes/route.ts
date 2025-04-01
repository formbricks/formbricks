import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { DatabaseError } from "@formbricks/types/errors";
import { getContactAttributes } from "./lib/contact-attributes";

export const GET = async (request: Request) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("Contacts are only enabled for Enterprise Edition, please upgrade.");
    }

    const contactAttributes = await getContactAttributes(authentication.environmentId);
    return responses.successResponse(contactAttributes);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};
