import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { ApiAuditLog, withApiLogging } from "@/app/lib/api/with-api-logging";
import { deleteActionClass, getActionClass, updateActionClass } from "@/lib/actionClass/service";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { logger } from "@formbricks/logger";
import { TActionClass, ZActionClassInput } from "@formbricks/types/action-classes";
import { TAuthenticationApiKey } from "@formbricks/types/auth";

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

  // Check if API key has permission to access this environment with appropriate permissions
  if (!hasPermission(authentication.environmentPermissions, actionClass.environmentId, method)) {
    throw new Error("Unauthorized");
  }

  return actionClass;
};

export const GET = async (
  request: Request,
  props: { params: Promise<{ actionClassId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const actionClass = await fetchAndAuthorizeActionClass(authentication, params.actionClassId, "GET");
    if (actionClass) {
      return responses.successResponse(actionClass);
    }
    return responses.notFoundResponse("Action Class", params.actionClassId);
  } catch (error) {
    return handleErrorResponse(error);
  }
};

export const PUT = withApiLogging(
  async (request: Request, props: { params: Promise<{ actionClassId: string }> }, auditLog: ApiAuditLog) => {
    const params = await props.params;
    try {
      const authentication = await authenticateRequest(request);
      if (!authentication) {
        return {
          response: responses.notAuthenticatedResponse(),
        };
      }
      auditLog.userId = authentication.apiKeyId;

      const actionClass = await fetchAndAuthorizeActionClass(authentication, params.actionClassId, "PUT");
      if (!actionClass) {
        return {
          response: responses.notFoundResponse("Action Class", params.actionClassId),
        };
      }
      auditLog.oldObject = actionClass;
      auditLog.organizationId = authentication.organizationId;

      let actionClassUpdate;
      try {
        actionClassUpdate = await request.json();
      } catch (error) {
        logger.error({ error, url: request.url }, "Error parsing JSON");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      const inputValidation = ZActionClassInput.safeParse(actionClassUpdate);
      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error)
          ),
        };
      }
      const updatedActionClass = await updateActionClass(
        inputValidation.data.environmentId,
        params.actionClassId,
        inputValidation.data
      );
      if (updatedActionClass) {
        auditLog.newObject = updatedActionClass;
        return {
          response: responses.successResponse(updatedActionClass),
        };
      }
      return {
        response: responses.internalServerErrorResponse("Some error occurred while updating action"),
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
  "updated",
  "actionClass"
);

export const DELETE = withApiLogging(
  async (request: Request, props: { params: Promise<{ actionClassId: string }> }, auditLog: ApiAuditLog) => {
    const params = await props.params;
    auditLog.targetId = params.actionClassId;

    try {
      const authentication = await authenticateRequest(request);
      if (!authentication) {
        return {
          response: responses.notAuthenticatedResponse(),
        };
      }
      auditLog.userId = authentication.apiKeyId;

      const actionClass = await fetchAndAuthorizeActionClass(authentication, params.actionClassId, "DELETE");
      if (!actionClass) {
        return {
          response: responses.notFoundResponse("Action Class", params.actionClassId),
        };
      }

      auditLog.oldObject = actionClass;
      auditLog.organizationId = authentication.organizationId;

      const deletedActionClass = await deleteActionClass(params.actionClassId);
      return {
        response: responses.successResponse(deletedActionClass),
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
  "deleted",
  "actionClass"
);
