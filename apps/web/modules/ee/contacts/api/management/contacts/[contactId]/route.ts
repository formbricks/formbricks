import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { deleteContact, getContact } from "./lib/contact";

// Please use the methods provided by the client API to update a person

const fetchAndAuthorizeContact = async (contactId: string) => {
  const contact = await getContact(contactId);

  if (!contact) {
    return null;
  }

  return contact;
};

export const GET = async (
  request: Request,
  { params: paramsPromise }: { params: Promise<{ contactId: string }> }
): Promise<Response> => {
  try {
    const params = await paramsPromise;
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("Contacts are only enabled for Enterprise Edition, please upgrade.");
    }

    const contact = await fetchAndAuthorizeContact(params.contactId);
    if (contact) {
      if (!hasPermission(authentication.environmentPermissions, contact.environmentId, "GET")) {
        return responses.unauthorizedResponse();
      }
      return responses.successResponse(contact);
    }

    return responses.notFoundResponse("Contact", params.contactId);
  } catch (error) {
    return handleErrorResponse(error);
  }
};

export const DELETE = async (
  request: Request,
  { params: paramsPromise }: { params: Promise<{ contactId: string }> }
) => {
  try {
    const params = await paramsPromise;
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("Contacts are only enabled for Enterprise Edition, please upgrade.");
    }

    const contact = await fetchAndAuthorizeContact(params.contactId);
    if (!contact) {
      return responses.notFoundResponse("Contact", params.contactId);
    }
    if (!hasPermission(authentication.environmentPermissions, contact.environmentId, "DELETE")) {
      return responses.unauthorizedResponse();
    }
    await deleteContact(params.contactId);
    return responses.successResponse({ success: "Contact deleted successfully" });
  } catch (error) {
    return handleErrorResponse(error);
  }
};
