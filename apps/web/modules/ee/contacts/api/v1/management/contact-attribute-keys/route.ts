import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { ApiAuditLog, withApiLogging } from "@/app/lib/api/with-api-logging";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { ZContactAttributeKeyCreateInput } from "./[contactAttributeKeyId]/types/contact-attribute-keys";
import { createContactAttributeKey, getContactAttributeKeys } from "./lib/contact-attribute-keys";

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

    const contactAttributeKeys = await getContactAttributeKeys(environmentIds);

    return responses.successResponse(contactAttributeKeys);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};

export const POST = withApiLogging(
  async (request: Request, _, auditLog: ApiAuditLog) => {
    try {
      const authentication = await authenticateRequest(request);
      if (!authentication) {
        return {
          response: responses.notAuthenticatedResponse(),
        };
      }
      auditLog.userId = authentication.apiKeyId;

      const isContactsEnabled = await getIsContactsEnabled();
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "Contacts are only enabled for Enterprise Edition, please upgrade."
          ),
        };
      }

      let contactAttibuteKeyInput;
      try {
        contactAttibuteKeyInput = await request.json();
      } catch (error) {
        logger.error({ error, url: request.url }, "Error parsing JSON input");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      const inputValidation = ZContactAttributeKeyCreateInput.safeParse(contactAttibuteKeyInput);

      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error),
            true
          ),
        };
      }
      const environmentId = contactAttibuteKeyInput.environmentId;
      auditLog.organizationId = authentication.organizationId;

      if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
        return {
          response: responses.unauthorizedResponse(),
        };
      }

      const contactAttributeKey = await createContactAttributeKey(
        environmentId,
        inputValidation.data.key,
        inputValidation.data.type
      );

      if (!contactAttributeKey) {
        return {
          response: responses.internalServerErrorResponse("Failed creating attribute class"),
        };
      }
      auditLog.targetId = contactAttributeKey.id;
      auditLog.newObject = contactAttributeKey;
      return {
        response: responses.successResponse(contactAttributeKey),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        return {
          response: responses.badRequestResponse(error.message),
        };
      }
      throw error;
    }
  },
  "created",
  "contactAttributeKey"
);
