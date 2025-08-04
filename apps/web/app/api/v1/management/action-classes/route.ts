import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { TApiAuditLog, TApiKeyAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { createActionClass } from "@/lib/actionClass/service";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { logger } from "@formbricks/logger";
import { TActionClass, ZActionClassInput } from "@formbricks/types/action-classes";
import { DatabaseError } from "@formbricks/types/errors";
import { getActionClasses } from "./lib/action-classes";

export const GET = withV1ApiWrapper(
  async (_request: Request, _, _auditLog: TApiAuditLog, authentication: TApiKeyAuthentication) => {
    if (!authentication) {
      return {
        response: responses.notAuthenticatedResponse(),
      };
    }

    try {
      const environmentIds = authentication.environmentPermissions.map(
        (permission) => permission.environmentId
      );

      const actionClasses = await getActionClasses(environmentIds);

      return {
        response: responses.successResponse(actionClasses),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        return {
          response: responses.badRequestResponse(error.message),
        };
      }
      throw error;
    }
  }
);

export const POST = withV1ApiWrapper(
  async (request: Request, _, auditLog: TApiAuditLog, authentication: TApiKeyAuthentication) => {
    if (!authentication) {
      return {
        response: responses.notAuthenticatedResponse(),
      };
    }

    try {
      let actionClassInput;
      try {
        actionClassInput = await request.json();
      } catch (error) {
        logger.error({ error, url: request.url }, "Error parsing JSON input");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      const inputValidation = ZActionClassInput.safeParse(actionClassInput);
      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error),
            true
          ),
        };
      }

      const environmentId = inputValidation.data.environmentId;

      if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
        return {
          response: responses.unauthorizedResponse(),
        };
      }

      const actionClass: TActionClass = await createActionClass(environmentId, inputValidation.data);
      auditLog.targetId = actionClass.id;
      auditLog.newObject = actionClass;
      return {
        response: responses.successResponse(actionClass),
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
  "actionClass"
);
