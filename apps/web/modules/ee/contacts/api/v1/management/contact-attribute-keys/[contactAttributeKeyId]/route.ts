import { logger } from "@formbricks/logger";
import { handleErrorResponse } from "@/app/api/v1/auth";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { TApiKeyAuthentication, THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import {
  deleteContactAttributeKey,
  getContactAttributeKey,
  updateContactAttributeKey,
} from "./lib/contact-attribute-key";
import { ZContactAttributeKeyUpdateInput } from "./types/contact-attribute-keys";

async function fetchAndAuthorizeContactAttributeKey(
  attributeKeyId: string,
  workspacePermissions: NonNullable<TApiKeyAuthentication>["workspacePermissions"],
  requiredPermission: "GET" | "PUT" | "DELETE"
) {
  const attributeKey = await getContactAttributeKey(attributeKeyId);
  if (!attributeKey) {
    return { error: responses.notFoundResponse("Attribute Key", attributeKeyId) };
  }

  if (!hasPermission(workspacePermissions, attributeKey.workspaceId, requiredPermission)) {
    return { error: responses.unauthorizedResponse() };
  }

  return { attributeKey };
}
export const GET = withV1ApiWrapper({
  handler: async ({
    props,
    authentication,
  }: THandlerParams<{ params: Promise<{ contactAttributeKeyId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      const params = await props.params;

      const result = await fetchAndAuthorizeContactAttributeKey(
        params.contactAttributeKeyId,
        authentication.workspacePermissions,
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
  },
});

export const DELETE = withV1ApiWrapper({
  handler: async ({
    props,
    auditLog,
    authentication,
  }: THandlerParams<{ params: Promise<{ contactAttributeKeyId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const params = await props.params;
    if (auditLog) {
      auditLog.targetId = params.contactAttributeKeyId;
    }
    try {
      const result = await fetchAndAuthorizeContactAttributeKey(
        params.contactAttributeKeyId,
        authentication.workspacePermissions,
        "DELETE"
      );

      if (result.error) {
        return {
          response: result.error,
        };
      }
      if (auditLog) {
        auditLog.oldObject = result.attributeKey;
      }
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
  action: "deleted",
  targetType: "contactAttributeKey",
});

export const PUT = withV1ApiWrapper({
  handler: async ({
    req,
    props,
    auditLog,
    authentication,
  }: THandlerParams<{ params: Promise<{ contactAttributeKeyId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const params = await props.params;
    if (auditLog) {
      auditLog.targetId = params.contactAttributeKeyId;
    }
    try {
      const result = await fetchAndAuthorizeContactAttributeKey(
        params.contactAttributeKeyId,
        authentication.workspacePermissions,
        "PUT"
      );
      if (result.error) {
        return {
          response: result.error,
        };
      }
      if (auditLog) {
        auditLog.oldObject = result.attributeKey;
      }

      let contactAttributeKeyUpdate;
      try {
        contactAttributeKeyUpdate = await parseJsonBodyWithLimit(req);
      } catch (error) {
        if (error instanceof RequestBodyTooLargeError) {
          return {
            response: responses.payloadTooLargeResponse("Payload Too Large", { error: error.message }),
          };
        }

        logger.error({ error, url: req.url }, "Error parsing JSON input");
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
        if (auditLog) {
          auditLog.newObject = updatedAttributeClass;
        }
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
  action: "updated",
  targetType: "contactAttributeKey",
});
