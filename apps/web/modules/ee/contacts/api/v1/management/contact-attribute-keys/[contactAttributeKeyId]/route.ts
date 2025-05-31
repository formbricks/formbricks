import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { ApiAuditLog, withApiLogging } from "@/app/lib/api/with-api-logging";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import {
  deleteContactAttributeKey,
  getContactAttributeKey,
  updateContactAttributeKey,
} from "./lib/contact-attribute-key";
import { ZContactAttributeKeyUpdateInput } from "./types/contact-attribute-keys";

async function fetchAndAuthorizeContactAttributeKey(
  attributeKeyId: string,
  authentication: TAuthenticationApiKey,
  requiredPermission: "GET" | "PUT" | "DELETE"
) {
  const attributeKey = await getContactAttributeKey(attributeKeyId);
  if (!attributeKey) {
    return { error: responses.notFoundResponse("Attribute Key", attributeKeyId) };
  }

  if (!hasPermission(authentication.environmentPermissions, attributeKey.environmentId, requiredPermission)) {
    return { error: responses.unauthorizedResponse() };
  }

  return { attributeKey };
}
export const GET = async (
  request: Request,
  { params: paramsPromise }: { params: Promise<{ contactAttributeKeyId: string }> }
): Promise<Response> => {
  try {
    const params = await paramsPromise;
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const result = await fetchAndAuthorizeContactAttributeKey(
      params.contactAttributeKeyId,
      authentication,
      "GET"
    );
    if (result.error) return result.error;

    return responses.successResponse(result.attributeKey);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Contacts are only enabled for Enterprise Edition, please upgrade."
    ) {
      return responses.forbiddenResponse(error.message);
    }
    return handleErrorResponse(error);
  }
};

export const DELETE = withApiLogging(
  async (
    request: Request,
    { params: paramsPromise }: { params: Promise<{ contactAttributeKeyId: string }> }
  ) => {
    const params = await paramsPromise;
    const auditLog: ApiAuditLog = {
      actionType: "contactAttributeKey.deleted",
      targetType: "contactAttributeKey",
      userId: UNKNOWN_DATA,
      targetId: params.contactAttributeKeyId,
      organizationId: UNKNOWN_DATA,
      status: "failure",
      oldObject: undefined,
    };
    try {
      const authentication = await authenticateRequest(request);
      if (!authentication) {
        return {
          response: responses.notAuthenticatedResponse(),
          audit: auditLog,
        };
      }
      auditLog.userId = authentication.apiKeyId;

      const result = await fetchAndAuthorizeContactAttributeKey(
        params.contactAttributeKeyId,
        authentication,
        "DELETE"
      );

      if (result.error) {
        return {
          response: result.error,
          audit: auditLog,
        };
      }
      auditLog.oldObject = result.attributeKey;
      auditLog.organizationId = authentication.organizationId;
      if (result.attributeKey.type === "default") {
        return {
          response: responses.badRequestResponse("Default Contact Attribute Keys cannot be deleted"),
          audit: auditLog,
        };
      }
      const deletedContactAttributeKey = await deleteContactAttributeKey(params.contactAttributeKeyId);
      auditLog.status = "success";
      return {
        response: responses.successResponse(deletedContactAttributeKey),
        audit: auditLog,
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
        audit: auditLog,
      };
    }
  }
);

export const PUT = withApiLogging(
  async (
    request: Request,
    { params: paramsPromise }: { params: Promise<{ contactAttributeKeyId: string }> }
  ) => {
    const params = await paramsPromise;
    const auditLog: ApiAuditLog = {
      actionType: "contactAttributeKey.updated",
      targetType: "contactAttributeKey",
      userId: UNKNOWN_DATA,
      targetId: params.contactAttributeKeyId,
      organizationId: UNKNOWN_DATA,
      status: "failure",
      oldObject: undefined,
      newObject: undefined,
    };
    try {
      const authentication = await authenticateRequest(request);
      if (!authentication) {
        return {
          response: responses.notAuthenticatedResponse(),
          audit: auditLog,
        };
      }
      auditLog.userId = authentication.apiKeyId;

      const result = await fetchAndAuthorizeContactAttributeKey(
        params.contactAttributeKeyId,
        authentication,
        "PUT"
      );
      if (result.error) {
        return {
          response: result.error,
          audit: auditLog,
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
          audit: auditLog,
        };
      }

      const inputValidation = ZContactAttributeKeyUpdateInput.safeParse(contactAttributeKeyUpdate);
      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error)
          ),
          audit: auditLog,
        };
      }
      const updatedAttributeClass = await updateContactAttributeKey(
        params.contactAttributeKeyId,
        inputValidation.data
      );
      if (updatedAttributeClass) {
        auditLog.status = "success";
        auditLog.newObject = updatedAttributeClass;
        return {
          response: responses.successResponse(updatedAttributeClass),
          audit: auditLog,
        };
      }
      return {
        response: responses.internalServerErrorResponse("Some error ocured while updating action"),
        audit: auditLog,
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
        audit: auditLog,
      };
    }
  }
);
