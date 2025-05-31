import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { ApiAuditLog, withApiLogging } from "@/app/lib/api/with-api-logging";
import { deleteActionClass, getActionClass, updateActionClass } from "@/lib/actionClass/service";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
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
  async (request: Request, props: { params: Promise<{ actionClassId: string }> }) => {
    const auditLog: ApiAuditLog = {
      actionType: "actionClass.updated",
      targetType: "actionClass",
      userId: UNKNOWN_DATA,
      targetId: UNKNOWN_DATA,
      organizationId: UNKNOWN_DATA,
      status: "failure",
      oldObject: undefined,
      newObject: undefined,
    };
    const params = await props.params;
    try {
      const authentication = await authenticateRequest(request);
      if (!authentication) {
        return {
          response: responses.notAuthenticatedResponse(),
          audit: auditLog,
        };
      }
      auditLog.userId = authentication.apiKeyId;
      auditLog.targetId = params.actionClassId;

      const actionClass = await fetchAndAuthorizeActionClass(authentication, params.actionClassId, "PUT");
      if (!actionClass) {
        return {
          response: responses.notFoundResponse("Action Class", params.actionClassId),
          audit: auditLog,
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
          audit: auditLog,
        };
      }

      const inputValidation = ZActionClassInput.safeParse(actionClassUpdate);
      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error)
          ),
          audit: auditLog,
        };
      }
      const updatedActionClass = await updateActionClass(
        inputValidation.data.environmentId,
        params.actionClassId,
        inputValidation.data
      );
      if (updatedActionClass) {
        auditLog.status = "success";
        auditLog.newObject = updatedActionClass;
        return {
          response: responses.successResponse(updatedActionClass),
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

export const DELETE = withApiLogging(
  async (request: Request, props: { params: Promise<{ actionClassId: string }> }) => {
    const auditLog: ApiAuditLog = {
      actionType: "actionClass.deleted",
      targetType: "actionClass",
      userId: UNKNOWN_DATA,
      targetId: UNKNOWN_DATA,
      organizationId: UNKNOWN_DATA,
      status: "failure",
      oldObject: undefined,
    };
    const params = await props.params;
    try {
      const authentication = await authenticateRequest(request);
      if (!authentication) {
        return {
          response: responses.notAuthenticatedResponse(),
          audit: auditLog,
        };
      }
      auditLog.userId = authentication.apiKeyId;
      auditLog.targetId = params.actionClassId;

      const actionClass = await fetchAndAuthorizeActionClass(authentication, params.actionClassId, "DELETE");
      if (!actionClass) {
        return {
          response: responses.notFoundResponse("Action Class", params.actionClassId),
          audit: auditLog,
        };
      }

      auditLog.oldObject = actionClass;
      auditLog.organizationId = authentication.organizationId;

      const deletedActionClass = await deleteActionClass(params.actionClassId);
      auditLog.status = "success";
      return {
        response: responses.successResponse(deletedActionClass),
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
