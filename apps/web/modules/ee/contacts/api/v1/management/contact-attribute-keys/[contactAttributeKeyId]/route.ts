import { handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { TApiAuditLog, TApiKeyAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { logger } from "@formbricks/logger";
import {
  deleteContactAttributeKey,
  getContactAttributeKey,
  updateContactAttributeKey,
} from "./lib/contact-attribute-key";
import { ZContactAttributeKeyUpdateInput } from "./types/contact-attribute-keys";

async function fetchAndAuthorizeContactAttributeKey(
  attributeKeyId: string,
  authentication: TApiKeyAuthentication,
  requiredPermission: "GET" | "PUT" | "DELETE"
) {
  const attributeKey = await getContactAttributeKey(attributeKeyId);
  if (!attributeKey) {
    return { error: responses.notFoundResponse("Attribute Key", attributeKeyId) };
  }

  if (
    !authentication ||
    !hasPermission(authentication.environmentPermissions, attributeKey.environmentId, requiredPermission)
  ) {
    return { error: responses.unauthorizedResponse() };
  }

  return { attributeKey };
}
export const GET = withV1ApiWrapper(
  async (
    _: Request,
    props: { params: Promise<{ contactAttributeKeyId: string }> },
    _auditLog: TApiAuditLog,
    authentication: TApiKeyAuthentication
  ) => {
    if (!authentication) {
      return {
        response: responses.notAuthenticatedResponse(),
      };
    }

    try {
      const params = await props.params;

      const result = await fetchAndAuthorizeContactAttributeKey(
        params.contactAttributeKeyId,
        authentication,
        "GET"
      );
      if (result.error) {
        return {
          response: result.error,
        };
      }

      return {
        response: responses.successResponse(result.attributeKey),
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Contacts are only enabled for Enterprise Edition, please upgrade."
      ) {
        return {
          response: responses.forbiddenResponse(error.message),
        };
      }
      return {
        response: handleErrorResponse(error),
      };
    }
  }
);

export const DELETE = withV1ApiWrapper(
  async (
    _: Request,
    props: { params: Promise<{ contactAttributeKeyId: string }> },
    auditLog: TApiAuditLog,
    authentication: TApiKeyAuthentication
  ) => {
    if (!authentication) {
      return {
        response: responses.notAuthenticatedResponse(),
      };
    }

    const params = await props.params;
    auditLog.targetId = params.contactAttributeKeyId;
    try {
      const result = await fetchAndAuthorizeContactAttributeKey(
        params.contactAttributeKeyId,
        authentication,
        "DELETE"
      );

      if (result.error) {
        return {
          response: result.error,
        };
      }
      auditLog.oldObject = result.attributeKey;
      auditLog.organizationId = authentication.organizationId;
      if (result.attributeKey.type === "default") {
        return {
          response: responses.badRequestResponse("Default Contact Attribute Keys cannot be deleted"),
        };
      }
      const deletedContactAttributeKey = await deleteContactAttributeKey(params.contactAttributeKeyId);
      return {
        response: responses.successResponse(deletedContactAttributeKey),
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
  "deleted",
  "contactAttributeKey"
);

export const PUT = withV1ApiWrapper(
  async (
    request: Request,
    props: { params: Promise<{ contactAttributeKeyId: string }> },
    auditLog: TApiAuditLog,
    authentication: TApiKeyAuthentication
  ) => {
    if (!authentication) {
      return {
        response: responses.notAuthenticatedResponse(),
      };
    }
    const params = await props.params;
    auditLog.targetId = params.contactAttributeKeyId;
    try {
      const result = await fetchAndAuthorizeContactAttributeKey(
        params.contactAttributeKeyId,
        authentication,
        "PUT"
      );
      if (result.error) {
        return {
          response: result.error,
        };
      }
      auditLog.oldObject = result.attributeKey;
      auditLog.organizationId = authentication.organizationId;

      let contactAttributeKeyUpdate;
      try {
        contactAttributeKeyUpdate = await request.json();
      } catch (error) {
        logger.error({ error, url: request.url }, "Error parsing JSON input");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      const inputValidation = ZContactAttributeKeyUpdateInput.safeParse(contactAttributeKeyUpdate);
      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error)
          ),
        };
      }
      const updatedAttributeClass = await updateContactAttributeKey(
        params.contactAttributeKeyId,
        inputValidation.data
      );
      if (updatedAttributeClass) {
        auditLog.newObject = updatedAttributeClass;
        return {
          response: responses.successResponse(updatedAttributeClass),
        };
      }
      return {
        response: responses.internalServerErrorResponse(
          "Some error occurred while updating contact attribute key"
        ),
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
  "updated",
  "contactAttributeKey"
);
