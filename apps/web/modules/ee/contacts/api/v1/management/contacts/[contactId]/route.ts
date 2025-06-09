import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { ApiAuditLog, withApiLogging } from "@/app/lib/api/with-api-logging";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { deleteContact, getContact } from "./lib/contact";

// Please use the methods provided by the client API to update a person

const fetchAndAuthorizeContact = async (
  contactId: string,
  authentication: TAuthenticationApiKey,
  requiredPermission: "GET" | "PUT" | "DELETE"
) => {
  const contact = await getContact(contactId);

  if (!contact) {
    return { error: responses.notFoundResponse("Contact", contactId) };
  }

  if (!hasPermission(authentication.environmentPermissions, contact.environmentId, requiredPermission)) {
    return { error: responses.unauthorizedResponse() };
  }

  return { contact };
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

    const result = await fetchAndAuthorizeContact(params.contactId, authentication, "GET");
    if (result.error) return result.error;

    return responses.successResponse(result.contact);
  } catch (error) {
    return handleErrorResponse(error);
  }
};

export const DELETE = withApiLogging(
  async (
    request: Request,
    { params: paramsPromise }: { params: Promise<{ contactId: string }> },
    auditLog: ApiAuditLog
  ) => {
    const params = await paramsPromise;
    auditLog.targetId = params.contactId;

    try {
      const authentication = await authenticateRequest(request);
      if (!authentication) {
        return {
          response: responses.notAuthenticatedResponse(),
        };
      }
      auditLog.userId = authentication.apiKeyId;
      auditLog.organizationId = authentication.organizationId;

      const isContactsEnabled = await getIsContactsEnabled();
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "Contacts are only enabled for Enterprise Edition, please upgrade."
          ),
        };
      }

      const result = await fetchAndAuthorizeContact(params.contactId, authentication, "DELETE");
      if (result.error) {
        return {
          response: result.error,
        };
      }
      auditLog.oldObject = result.contact;

      await deleteContact(params.contactId);
      return {
        response: responses.successResponse({ success: "Contact deleted successfully" }),
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
  "deleted",
  "contact"
);
