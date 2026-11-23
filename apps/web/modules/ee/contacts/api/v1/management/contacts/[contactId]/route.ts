import { handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { TApiKeyAuthentication, THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getWorkspaceAuthorizationActionForMethod } from "@/lib/authorization/permission-action";
import { toV1Contact } from "@/modules/ee/contacts/api/v1/management/contacts/lib/contacts";
import { findApiKeyWorkspaceOnDirectory } from "@/modules/ee/contacts/lib/api-key-directory-access";
import { deleteContactInWorkspace } from "@/modules/ee/contacts/lib/contacts";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getContact } from "./lib/contact";

// Please use the methods provided by the client API to update a person

/**
 * The contact, when the key may act on a workspace that uses the contact's directory. `workspaceId` is
 * that workspace: deletes are scoped to it, and the response reports it when the contact's own origin
 * workspace is gone.
 */
const fetchAndAuthorizeContact = async (
  contactId: string,
  authentication: NonNullable<TApiKeyAuthentication>,
  requiredPermission: "GET" | "PUT" | "DELETE"
) => {
  const contact = await getContact(contactId);

  if (!contact) {
    return { error: responses.notFoundResponse("Contact", contactId) };
  }

  const workspaceId = await findApiKeyWorkspaceOnDirectory(
    authentication.apiKeyId,
    getWorkspaceAuthorizationActionForMethod(requiredPermission),
    contact.directoryId,
    authentication.workspacePermissions.map((permission) => permission.workspaceId)
  );
  if (!workspaceId) {
    return { error: responses.unauthorizedResponse() };
  }

  return { contact: toV1Contact(contact, workspaceId), workspaceId };
};

export const GET = withV1ApiWrapper({
  handler: async ({ props, authentication }: THandlerParams<{ params: Promise<{ contactId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      const params = await props.params;

      const isContactsEnabled = await getIsContactsEnabled(authentication.organizationId);
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "Contacts are only enabled for Enterprise Edition, please upgrade."
          ),
        };
      }

      const result = await fetchAndAuthorizeContact(params.contactId, authentication, "GET");
      if (result.error) {
        return {
          response: result.error,
        };
      }

      return {
        response: responses.successResponse(result.contact),
      };
    } catch (error) {
      return handleErrorResponse(error);
    }
  },
});

export const DELETE = withV1ApiWrapper({
  handler: async ({
    props,
    auditLog,
    authentication,
  }: THandlerParams<{ params: Promise<{ contactId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const params = await props.params;
    if (auditLog) {
      auditLog.targetId = params.contactId;
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

      const result = await fetchAndAuthorizeContact(params.contactId, authentication, "DELETE");
      if (result.error) {
        return {
          response: result.error,
        };
      }
      if (auditLog) {
        auditLog.oldObject = result.contact;
      }

      await deleteContactInWorkspace(params.contactId, result.workspaceId);
      return {
        response: responses.successResponse({ success: "Contact deleted successfully" }),
      };
    } catch (error) {
      return handleErrorResponse(error);
    }
  },
  action: "deleted",
  targetType: "contact",
});
