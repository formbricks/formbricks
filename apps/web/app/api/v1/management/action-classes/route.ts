import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { ApiAuditLog, withApiLogging } from "@/app/lib/api/with-api-logging";
import { createActionClass } from "@/lib/actionClass/service";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { logger } from "@formbricks/logger";
import { TActionClass, ZActionClassInput } from "@formbricks/types/action-classes";
import { DatabaseError } from "@formbricks/types/errors";
import { getActionClasses } from "./lib/action-classes";

export const GET = async (request: Request) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const environmentIds = authentication.environmentPermissions.map(
      (permission) => permission.environmentId
    );

    const actionClasses = await getActionClasses(environmentIds);

    return responses.successResponse(actionClasses);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};

export const POST = withApiLogging(async (request: Request) => {
  const auditLog: ApiAuditLog = {
    actionType: "actionClass.created",
    targetType: "actionClass",
    userId: UNKNOWN_DATA,
    targetId: UNKNOWN_DATA,
    organizationId: UNKNOWN_DATA,
    status: "failure",
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

    let actionClassInput;
    try {
      actionClassInput = await request.json();
    } catch (error) {
      logger.error({ error, url: request.url }, "Error parsing JSON input");
      return {
        response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        audit: auditLog,
      };
    }

    const inputValidation = ZActionClassInput.safeParse(actionClassInput);
    const environmentId = actionClassInput.environmentId;

    if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
      return {
        response: responses.unauthorizedResponse(),
        audit: auditLog,
      };
    }

    if (!inputValidation.success) {
      return {
        response: responses.badRequestResponse(
          "Fields are missing or incorrectly formatted",
          transformErrorToDetails(inputValidation.error),
          true
        ),
        audit: auditLog,
      };
    }

    const actionClass: TActionClass = await createActionClass(environmentId, inputValidation.data);
    auditLog.status = "success";
    auditLog.targetId = actionClass.id;
    auditLog.newObject = actionClass;
    return {
      response: responses.successResponse(actionClass),
      audit: auditLog,
    };
  } catch (error) {
    if (error instanceof DatabaseError) {
      return {
        response: responses.badRequestResponse(error.message),
        audit: auditLog,
      };
    }
    throw error;
  }
});
