import { type NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { ZDeleteFileRequest, ZDownloadFileRequest } from "@formbricks/types/storage";
import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { authorizePrivateDownload } from "@/app/storage/[workspaceId]/[accessType]/[...filePath]/lib/auth";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
import { getSession } from "@/modules/auth/lib/session";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { deleteFile, getFileStreamForDownload } from "@/modules/storage/service";
import { getErrorResponseFromStorageError } from "@/modules/storage/utils";
import { logFileAudit, logFileDeletion } from "./lib/audit-logs";

type TFilePrincipal = { userId: string; userType: "user" | "api" };

// Only called once a request was authenticated but denied, so the principal is known and the volume is
// bounded by valid credentials.
const getDeniedPrincipal = async (request: NextRequest): Promise<TFilePrincipal | undefined> => {
  const session = await getSession();
  if (session?.user) return { userId: session.user.id, userType: "user" };
  const auth = await authenticateRequest(request);
  return auth ? { userId: auth.apiKeyId, userType: "api" } : undefined;
};

export const GET = async (
  request: NextRequest,
  props: { params: Promise<{ workspaceId: string; accessType: string; filePath: string[] }> }
): Promise<Response> => {
  const params = await props.params;
  const fileName = params.filePath.join("/");
  const paramValidation = ZDownloadFileRequest.safeParse({
    accessType: params.accessType,
    fileName,
  });

  if (!paramValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(paramValidation.error),
      true
    );
  }

  const { accessType } = paramValidation.data;
  const idParam = params.workspaceId;

  // Resolve: the URL param may be an environmentId (old uploads) or workspaceId (new uploads)
  const resolved = await resolveClientApiIds(idParam);
  if (!resolved) {
    return responses.notFoundResponse("Workspace", idParam);
  }

  // check auth
  let principal: TFilePrincipal | undefined;
  if (accessType === "private") {
    const authResult = await authorizePrivateDownload(request, resolved.workspaceId, "GET", params.filePath);
    if (!authResult.ok) {
      if (authResult.error.unauthorized) {
        await logFileAudit({
          action: "queried",
          failureReason: "not_authorized",
          accessType,
          fileName,
          workspaceId: resolved.workspaceId,
          apiUrl: request.url,
          ...(await getDeniedPrincipal(request)),
        });
      }
      return authResult.error.unauthorized
        ? responses.unauthorizedResponse()
        : responses.notAuthenticatedResponse();
    }
    principal =
      authResult.data.authType === "session"
        ? { userId: authResult.data.userId, userType: "user" }
        : { userId: authResult.data.apiKeyId, userType: "api" };
  }

  // Stream the file — try workspaceId path first (new uploads), fall back to environmentId (legacy)
  let streamResult: Awaited<ReturnType<typeof getFileStreamForDownload>>;
  try {
    streamResult = await getFileStreamForDownload(fileName, resolved.workspaceId, accessType, idParam);
  } catch (error) {
    if (principal) {
      await logFileAudit({
        action: "queried",
        failureReason: "unexpected_error",
        accessType,
        fileName,
        workspaceId: resolved.workspaceId,
        apiUrl: request.url,
        ...principal,
      });
    }
    throw error;
  }

  if (!streamResult.ok) {
    if (principal) {
      await logFileAudit({
        action: "queried",
        failureReason: streamResult.error.code,
        accessType,
        fileName,
        workspaceId: resolved.workspaceId,
        apiUrl: request.url,
        ...principal,
      });
    }
    const errorResponse = getErrorResponseFromStorageError(streamResult.error, { fileName });
    return errorResponse;
  }

  const { body, contentType, contentLength } = streamResult.data;

  // Private downloads only — public files are served without credentials, so there is no actor to record.
  if (principal) {
    await logFileAudit({
      action: "queried",
      status: "success",
      accessType,
      fileName,
      workspaceId: resolved.workspaceId,
      apiUrl: request.url,
      ...principal,
    });
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      ...(contentLength > 0 && { "Content-Length": String(contentLength) }),
      "Cache-Control":
        accessType === "private"
          ? "no-store, no-cache, must-revalidate"
          : "public, max-age=31536000, immutable",
    },
  });
};

export const DELETE = async (
  request: NextRequest,
  props: { params: Promise<{ workspaceId: string; accessType: string; filePath: string[] }> }
): Promise<Response> => {
  const params = await props.params;
  const fileName = params.filePath.join("/");
  const paramValidation = ZDeleteFileRequest.safeParse({
    accessType: params.accessType,
    fileName,
  });
  if (!paramValidation.success) {
    const errorDetails = transformErrorToDetails(paramValidation.error);

    await logFileDeletion({
      failureReason: "Parameter validation failed",
      workspaceId: params.workspaceId,
      apiUrl: request.url,
    });

    return responses.badRequestResponse("Fields are missing or incorrectly formatted", errorDetails, true);
  }

  const { accessType } = paramValidation.data;
  const idParam = params.workspaceId;

  // Resolve: the URL param may be an environmentId (old uploads) or workspaceId (new uploads)
  const resolved = await resolveClientApiIds(idParam);
  if (!resolved) {
    await logFileDeletion({
      failureReason: "Workspace not found",
      workspaceId: idParam,
      apiUrl: request.url,
    });
    return responses.notFoundResponse("Workspace", idParam);
  }

  const authResult = await authorizePrivateDownload(request, resolved.workspaceId, "DELETE", params.filePath);

  if (!authResult.ok) {
    await logFileDeletion({
      failureReason: authResult.error.unauthorized
        ? "User not authorized to access workspace"
        : "User not authenticated",
      accessType,
      fileName,
      workspaceId: resolved.workspaceId,
      apiUrl: request.url,
      ...(authResult.error.unauthorized && (await getDeniedPrincipal(request))),
    });

    return authResult.error.unauthorized
      ? responses.unauthorizedResponse()
      : responses.notAuthenticatedResponse();
  }

  const principal: TFilePrincipal =
    authResult.data.authType === "session"
      ? { userId: authResult.data.userId, userType: "user" }
      : { userId: authResult.data.apiKeyId, userType: "api" };
  const auditBase = {
    accessType,
    fileName,
    workspaceId: resolved.workspaceId,
    apiUrl: request.url,
    ...principal,
  };

  // Rate limiting for apiKey DELETE is enforced by Envoy in v5 — see envoy-rate-limit-coverage.ts
  if (authResult.data.authType !== "apiKey") {
    try {
      await applyRateLimit(rateLimitConfigs.storage.delete, authResult.data.userId);
    } catch (error) {
      await logFileDeletion({ ...auditBase, failureReason: "rate_limited" });
      return responses.tooManyRequestsResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    }
  }

  let deleteResult: Awaited<ReturnType<typeof deleteFile>>;
  try {
    deleteResult = await deleteFile(resolved.workspaceId, accessType, decodeURIComponent(fileName), idParam);
  } catch (error) {
    await logFileDeletion({ ...auditBase, failureReason: "unexpected_error" });
    throw error;
  }

  if (!deleteResult.ok) {
    if (!("error" in deleteResult)) {
      logger.error({ deleteResult }, "Unknown delete failure result shape");

      await logFileDeletion({ ...auditBase, failureReason: "unknown_delete_failure" });

      return responses.internalServerErrorResponse("Failed to delete file", true);
    }

    const { error } = deleteResult;

    logger.error({ error }, "Error deleting file");

    await logFileDeletion({ ...auditBase, failureReason: error.code });

    const errorResponse = getErrorResponseFromStorageError(error, { fileName });
    return errorResponse;
  }

  await logFileDeletion({ ...auditBase, status: "success" });

  return responses.successResponse("File deleted successfully");
};
