import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { TPerson } from "@formbricks/types/people";
import { deleteContact, getContact } from "../lib/contacts";

// Please use the methods provided by the client API to update a person

const fetchAndAuthorizeContact = async (
  authentication: TAuthenticationApiKey,
  contactId: string
): Promise<TPerson | null> => {
  const contact = await getContact(contactId);

  if (!contact) {
    return null;
  }

  if (contact.environmentId !== authentication.environmentId) {
    throw new AuthorizationError("Unauthorized");
  }

  return contact;
};

export const GET = async (
  request: Request,
  { params }: { params: { contactId: string } }
): Promise<Response> => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const contact = await fetchAndAuthorizeContact(authentication, params.contactId);
    if (contact) {
      return responses.successResponse(contact);
    }

    return responses.notFoundResponse("Contact", params.contactId);
  } catch (error) {
    return handleErrorResponse(error);
  }
};

export const DELETE = async (request: Request, { params }: { params: { contactId: string } }) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const person = await fetchAndAuthorizeContact(authentication, params.contactId);
    if (!person) {
      return responses.notFoundResponse("Contact", params.contactId);
    }
    await deleteContact(params.contactId);
    return responses.successResponse({ success: "Contact deleted successfully" });
  } catch (error) {
    return handleErrorResponse(error);
  }
};
