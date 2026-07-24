import { logger } from "@formbricks/logger";
import { TActionClass, ZActionClassInput } from "@formbricks/types/action-classes";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { handleErrorResponse } from "@/app/api/v1/auth";
import { resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { deleteActionClass, getActionClass, updateActionClass } from "@/lib/actionClass/service";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

const fetchAndAuthorizeActionClass = async (
  authentication: TAuthenticationApiKey,
  actionClassId: string,
  method: "GET" | "POST" | "PUT" | "DELETE"
): Promise<TActionClass | null> => {
  // Get the action class
  const actionClass = await getActionClass(actionClassId);
  if (!actionClass) {
    return null;
  }

  // Check if API key has permission to access this workspace with appropriate permissions
  if (!hasPermission(authentication.workspacePermissions, actionClass.workspaceId, method)) {
    throw new Error("Unauthorized");
  }

  return actionClass;
};

export const GET = withV1ApiWrapper({
  handler: async ({
    props,
    authentication,
  }: THandlerParams<{ params: Promise<{ actionClassId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const params = await props.params;

    try {
      const actionClass = await fetchAndAuthorizeActionClass(authentication, params.actionClassId, "GET");
      if (actionClass) {
        return {
          response: responses.successResponse(actionClass),
        };
      }
      return {
        response: responses.notFoundResponse("Action Class", params.actionClassId),
      };
    } catch (error) {
      return handleErrorResponse(error);
    }
  },
});

export const PUT = withV1ApiWrapper({
  handler: async ({
    req,
    props,
    auditLog,
    authentication,
  }: THandlerParams<{ params: Promise<{ actionClassId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const params = await props.params;

    try {
      const actionClass = await fetchAndAuthorizeActionClass(authentication, params.actionClassId, "PUT");
      if (!actionClass) {
        return {
          response: responses.notFoundResponse("Action Class", params.actionClassId),
        };
      }

      if (auditLog) {
        auditLog.oldObject = actionClass;
      }

      let actionClassUpdate;
      try {
        actionClassUpdate = await parseJsonBodyWithLimit<Record<string, unknown>>(req);
      } catch (error) {
        if (error instanceof RequestBodyTooLargeError) {
          return {
            response: responses.payloadTooLargeResponse("Payload Too Large", { error: error.message }),
          };
        }

        logger.error({ error, url: req.url }, "Error parsing JSON");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      // Accept workspaceId as alternative to environmentId — resolve to production environment
      const resolved = await resolveBodyIds(actionClassUpdate, authentication.workspacePermissions, "PUT");
      if (!resolved.ok) return { response: resolved.response };

      const inputValidation = ZActionClassInput.safeParse(resolved.body);
      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error)
          ),
        };
      }

      if (
        !resolved.alreadyAuthorized &&
        !hasPermission(authentication.workspacePermissions, inputValidation.data.workspaceId, "PUT")
      ) {
        return { response: responses.unauthorizedResponse() };
      }

      const updatedActionClass = await updateActionClass(
        inputValidation.data.workspaceId,
        params.actionClassId,
        inputValidation.data
      );
      if (updatedActionClass) {
        if (auditLog) {
          auditLog.newObject = updatedActionClass;
        }

        return {
          response: responses.successResponse(updatedActionClass),
        };
      }
      return {
        response: responses.internalServerErrorResponse("Some error occurred while updating action"),
      };
    } catch (error) {
      return handleErrorResponse(error);
    }
  },
  action: "updated",
  targetType: "actionClass",
});

export const DELETE = withV1ApiWrapper({
  handler: async ({
    props,
    auditLog,
    authentication,
  }: THandlerParams<{ params: Promise<{ actionClassId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const params = await props.params;

    if (auditLog) {
      auditLog.targetId = params.actionClassId;
    }

    try {
      const actionClass = await fetchAndAuthorizeActionClass(authentication, params.actionClassId, "DELETE");
      if (!actionClass) {
        return {
          response: responses.notFoundResponse("Action Class", params.actionClassId),
        };
      }

      if (auditLog) {
        auditLog.oldObject = actionClass;
      }

      const deletedActionClass = await deleteActionClass(params.actionClassId);
      return {
        response: responses.successResponse(deletedActionClass),
      };
    } catch (error) {
      return handleErrorResponse(error);
    }
  },
  action: "deleted",
  targetType: "actionClass",
});
