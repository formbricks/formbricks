import { handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { TApiAuditLog, TApiKeyAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { deleteContact, getContact } from "./lib/contact";

// Please use the methods provided by the client API to update a person

const fetchAndAuthorizeContact = async (
  contactId: string,
  environmentPermissions: NonNullable<TApiKeyAuthentication>["environmentPermissions"],
  requiredPermission: "GET" | "PUT" | "DELETE"
) => {
  const contact = await getContact(contactId);

  if (!contact) {
    return { error: responses.notFoundResponse("Contact", contactId) };
  }

  if (!hasPermission(environmentPermissions, contact.environmentId, requiredPermission)) {
    return { error: responses.unauthorizedResponse() };
  }

  return { contact };
};

export const GET = withV1ApiWrapper({
  handler: async ({
    props,
    authentication,
  }: {
    props: { params: Promise<{ contactId: string }> };
    authentication: NonNullable<TApiKeyAuthentication>;
  }) => {
    try {
      const params = await props.params;

      const isContactsEnabled = await getIsContactsEnabled();
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "Contacts are only enabled for Enterprise Edition, please upgrade."
          ),
        };
      }

      const result = await fetchAndAuthorizeContact(
        params.contactId,
        authentication.environmentPermissions,
        "GET"
      );
      if (result.error) {
        return {
          response: result.error,
        };
      }

      return {
        response: responses.successResponse(result.contact),
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
});

export const DELETE = withV1ApiWrapper({
  handler: async ({
    props,
    auditLog,
    authentication,
  }: {
    props: { params: Promise<{ contactId: string }> };
    auditLog: TApiAuditLog;
    authentication: NonNullable<TApiKeyAuthentication>;
  }) => {
    const params = await props.params;
    auditLog.targetId = params.contactId;

    try {
      const isContactsEnabled = await getIsContactsEnabled();
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "Contacts are only enabled for Enterprise Edition, please upgrade."
          ),
        };
      }

      const result = await fetchAndAuthorizeContact(
        params.contactId,
        authentication.environmentPermissions,
        "DELETE"
      );
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
  action: "deleted",
  targetType: "contact",
});
