import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { handleDeleteFile } from "@/app/storage/[environmentId]/[accessType]/[fileName]/lib/delete-file";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { getServerSession } from "next-auth";
import { type NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { ZStorageRetrievalParams } from "@formbricks/types/storage";
import { getFile } from "./lib/get-file";

export const GET = async (
  request: NextRequest,
  props: { params: Promise<{ environmentId: string; accessType: string; fileName: string }> }
): Promise<Response> => {
  const params = await props.params;
  const paramValidation = ZStorageRetrievalParams.safeParse(params);

  if (!paramValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(paramValidation.error),
      true
    );
  }

  const { environmentId, accessType, fileName: fileNameOG } = params;

  const fileName = decodeURIComponent(fileNameOG);

  if (accessType === "public") {
    return await getFile(environmentId, accessType, fileName);
  }

  // if the user is authenticated via the session

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    // check for api key auth
    const res = await authenticateRequest(request);

    if (!res) {
      return responses.notAuthenticatedResponse();
    }

    return await getFile(environmentId, accessType, fileName);
  }

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);

  if (!isUserAuthorized) {
    return responses.unauthorizedResponse();
  }

  return await getFile(environmentId, accessType, fileName);
};

export const DELETE = async (
  request: NextRequest,
  props: { params: Promise<{ fileName: string }> }
): Promise<Response> => {
  const params = await props.params;

  const getOrgId = async (environmentId: string): Promise<string> => {
    try {
      return await getOrganizationIdFromEnvironmentId(environmentId);
    } catch (error) {
      logger.error("Failed to get organization ID for environment", { error });
      return UNKNOWN_DATA;
    }
  };

  const logFileDeletion = async ({
    environmentId,
    accessType,
    userId,
    status = "failure",
    failureReason,
    oldObject,
  }: {
    environmentId?: string;
    accessType?: string;
    userId?: string;
    status?: TAuditStatus;
    failureReason?: string;
    oldObject?: Record<string, unknown>;
  }) => {
    try {
      const organizationId = environmentId ? await getOrgId(environmentId) : UNKNOWN_DATA;

      await queueAuditEvent({
        action: "deleted",
        targetType: "file",
        userId: userId || UNKNOWN_DATA,
        userType: "user",
        targetId: `${environmentId}:${accessType}`, // Generic target identifier
        organizationId,
        status,
        newObject: {
          environmentId,
          accessType,
          ...(failureReason && { failureReason }),
        },
        oldObject,
        apiUrl: request.url,
      });
    } catch (auditError) {
      logger.error("Failed to log file deletion audit event:", auditError);
    }
  };

  // Validation
  if (!params.fileName) {
    await logFileDeletion({
      failureReason: "fileName parameter missing",
    });
    return responses.badRequestResponse("Fields are missing or incorrectly formatted", {
      fileName: "fileName is required",
    });
  }

  const [environmentId, accessType, file] = params.fileName.split("/");
  const paramValidation = ZStorageRetrievalParams.safeParse({ fileName: file, environmentId, accessType });

  if (!paramValidation.success) {
    await logFileDeletion({
      failureReason: "Parameter validation failed",
    });
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(paramValidation.error),
      true
    );
  }

  const {
    environmentId: validEnvId,
    accessType: validAccessType,
    fileName: validFileName,
  } = paramValidation.data;

  // Authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    await logFileDeletion({
      failureReason: "User not authenticated",
      environmentId: validEnvId,
      accessType: validAccessType,
    });
    return responses.notAuthenticatedResponse();
  }

  // Authorization
  const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, validEnvId);
  if (!isUserAuthorized) {
    await logFileDeletion({
      failureReason: "User not authorized to access environment",
      environmentId: validEnvId,
      accessType: validAccessType,
      userId: session.user.id,
    });
    return responses.unauthorizedResponse();
  }

  try {
    const deleteResult = await handleDeleteFile(validEnvId, validAccessType, validFileName);
    const isSuccess = deleteResult.status === 200;
    let failureReason = "File deletion failed";

    if (!isSuccess) {
      try {
        const responseBody = await deleteResult.json();
        failureReason = responseBody.message || failureReason;
      } catch (error) {
        logger.error("Failed to parse file delete error response body", { error });
      }
    }

    await logFileDeletion({
      status: isSuccess ? "success" : "failure",
      failureReason: isSuccess ? undefined : failureReason,
      environmentId: validEnvId,
      accessType: validAccessType,
      userId: session.user.id,
    });

    return deleteResult;
  } catch (error) {
    await logFileDeletion({
      failureReason: error instanceof Error ? error.message : "Unexpected error during file deletion",
      environmentId: validEnvId,
      accessType: validAccessType,
      userId: session.user.id,
    });
    throw error;
  }
};
