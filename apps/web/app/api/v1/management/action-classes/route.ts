import { logger } from "@formbricks/logger";
import { TActionClass, ZActionClassInput } from "@formbricks/types/action-classes";
import { DatabaseError, UniqueConstraintError } from "@formbricks/types/errors";
import { resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { createActionClass } from "@/lib/actionClass/service";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { getActionClasses } from "./lib/action-classes";

export const GET = withV1ApiWrapper({
  handler: async ({ authentication }) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      const workspaceIds = [
        ...new Set(authentication.workspacePermissions.map((permission) => permission.workspaceId)),
      ];

      const actionClasses = await getActionClasses(workspaceIds);

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
  },
});

export const POST = withV1ApiWrapper({
  handler: async ({ req, auditLog, authentication }: THandlerParams) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      let actionClassInput;
      try {
        actionClassInput = await req.json();
      } catch (error) {
        logger.error({ error, url: req.url }, "Error parsing JSON input");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      // Validate workspace-level permission
      const resolved = await resolveBodyIds(actionClassInput, authentication.workspacePermissions, "POST");
      if (!resolved.ok) return { response: resolved.response };

      const inputValidation = ZActionClassInput.safeParse(resolved.body);
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
        !hasPermission(authentication.workspacePermissions, inputValidation.data.workspaceId, "POST")
      ) {
        return { response: responses.unauthorizedResponse() };
      }

      const actionClass: TActionClass = await createActionClass(inputValidation.data);
      if (auditLog) {
        auditLog.targetId = actionClass.id;
        auditLog.newObject = actionClass;
      }
      return {
        response: responses.successResponse(actionClass),
      };
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        return {
          response: responses.conflictResponse(error.message),
        };
      }
      if (error instanceof DatabaseError) {
        return {
          response: responses.badRequestResponse(error.message),
        };
      }
      throw error;
    }
  },
  action: "created",
  targetType: "actionClass",
});
