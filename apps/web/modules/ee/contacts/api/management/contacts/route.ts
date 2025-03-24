import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { TContact } from "@/modules/ee/contacts/types/contact";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { DatabaseError } from "@formbricks/types/errors";
import { getContacts } from "./lib/contacts";

export const GET = async (request: Request) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("Contacts are only enabled for Enterprise Edition, please upgrade.");
    }

    const environmentIds = authentication.environmentPermissions.map(
      (permission) => permission.environmentId
    );

    const allContacts: TContact[] = [];
    for (const environmentId of environmentIds) {
      const contacts = await getContacts(environmentId);
      allContacts.push(...contacts);
    }

    return responses.successResponse(allContacts);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};

// Please use the client API to create a new contact
