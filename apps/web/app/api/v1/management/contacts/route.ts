import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { DatabaseError } from "@formbricks/types/errors";
import { getContacts } from "./lib/contacts";

export const GET = async (request: Request) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const contacts = await getContacts(authentication.environmentId!);
    return responses.successResponse(contacts);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};

// Please use the client API to create a new contact
