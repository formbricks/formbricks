import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { CONTACTS_API_V1_NOT_ENABLED_MESSAGE } from "@/modules/ee/contacts/lib/contacts-entitlement";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { hasApiKeyWorkspaceAccess } from "@/modules/organization/settings/api-keys/lib/utils";
import { ZContactAttributeKeyCreateInput } from "./[contactAttributeKeyId]/types/contact-attribute-keys";
import { createContactAttributeKey, getContactAttributeKeys } from "./lib/contact-attribute-keys";

export const GET = withV1ApiWrapper({
  handler: async ({ authentication }) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      const isContactsEnabled = await getIsContactsEnabled(authentication.organizationId);
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(CONTACTS_API_V1_NOT_ENABLED_MESSAGE),
        };
      }

      const workspaceIds = [
        ...new Set(authentication.workspacePermissions.map((permission) => permission.workspaceId)),
      ];

      const contactAttributeKeys = await getContactAttributeKeys(workspaceIds);

      return {
        response: responses.successResponse(contactAttributeKeys),
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
});

export const POST = withV1ApiWrapper({
  handler: async ({ req, auditLog, authentication }: THandlerParams) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      const isContactsEnabled = await getIsContactsEnabled(authentication.organizationId);
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(CONTACTS_API_V1_NOT_ENABLED_MESSAGE),
        };
      }

      let contactAttributeKeyInput;
      try {
        contactAttributeKeyInput = await parseJsonBodyWithLimit<Record<string, unknown>>(req);
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

      // Accept workspaceId as alternative to environmentId — resolve to production environment
      const resolved = await resolveBodyIds(contactAttributeKeyInput, authentication, "POST");
      if (!resolved.ok) return { response: resolved.response };

      const inputValidation = ZContactAttributeKeyCreateInput.safeParse(resolved.body);

      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error),
            true
          ),
        };
      }
      if (
        !resolved.alreadyAuthorized &&
        !(await hasApiKeyWorkspaceAccess(authentication, inputValidation.data.workspaceId, "POST"))
      ) {
        return { response: responses.unauthorizedResponse() };
      }

      const contactAttributeKey = await createContactAttributeKey(
        inputValidation.data.workspaceId,
        inputValidation.data
      );

      if (!contactAttributeKey) {
        return {
          response: responses.internalServerErrorResponse("Failed creating attribute class"),
        };
      }
      if (auditLog) {
        auditLog.targetId = contactAttributeKey.id;
        auditLog.newObject = contactAttributeKey;
      }

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
  action: "created",
  targetType: "contactAttributeKey",
});
