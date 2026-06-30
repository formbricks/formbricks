import { getServerSession } from "next-auth";
import { type NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { ZDeleteFileRequest, ZDownloadFileRequest } from "@formbricks/types/storage";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { authorizePrivateDownload } from "@/app/storage/[workspaceId]/[accessType]/[...filePath]/lib/auth";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { deleteFile, getFileStreamForDownload } from "@/modules/storage/service";
import { getErrorResponseFromStorageError } from "@/modules/storage/utils";
import { logFileDeletion } from "./lib/audit-logs";

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
  if (accessType === "private") {
    const authResult = await authorizePrivateDownload(request, resolved.workspaceId, "GET");
    if (!authResult.ok) {
      return authResult.error.unauthorized
        ? responses.unauthorizedResponse()
        : responses.notAuthenticatedResponse();
    }
  }

  // Stream the file — try workspaceId path first (new uploads), fall back to environmentId (legacy)
  const streamResult = await getFileStreamForDownload(fileName, resolved.workspaceId, accessType, idParam);

  if (!streamResult.ok) {
    const errorResponse = getErrorResponseFromStorageError(streamResult.error, { fileName });
    return errorResponse;
  }

  const { body, contentType, contentLength } = streamResult.data;

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

  const session = await getServerSession(authOptions);

  const authResult = await authorizePrivateDownload(request, resolved.workspaceId, "DELETE");

  if (!authResult.ok) {
    await logFileDeletion({
      failureReason: authResult.error.unauthorized
        ? "User not authorized to access workspace"
        : "User not authenticated",
      accessType,
      workspaceId: resolved.workspaceId,
      apiUrl: request.url,
    });

    return authResult.error.unauthorized
      ? responses.unauthorizedResponse()
      : responses.notAuthenticatedResponse();
  }

  // Rate limiting for apiKey DELETE is enforced by Envoy in v5 — see envoy-rate-limit-coverage.ts
  if (authResult.ok && authResult.data.authType !== "apiKey") {
    try {
      await applyRateLimit(rateLimitConfigs.storage.delete, authResult.data.userId);
    } catch (error) {
      return responses.tooManyRequestsResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    }
  }

  const deleteResult = await deleteFile(
    resolved.workspaceId,
    accessType,
    decodeURIComponent(fileName),
    idParam
  );

  if (!deleteResult.ok) {
    if (!("error" in deleteResult)) {
      logger.error({ deleteResult }, "Unknown delete failure result shape");

      await logFileDeletion({
        failureReason: "unknown_delete_failure",
        accessType,
        userId: session?.user?.id,
        workspaceId: resolved.workspaceId,
        apiUrl: request.url,
      });

      return responses.internalServerErrorResponse("Failed to delete file", true);
    }

    const { error } = deleteResult;

    logger.error({ error }, "Error deleting file");

    await logFileDeletion({
      failureReason: error.code,
      accessType,
      userId: session?.user?.id,
      workspaceId: resolved.workspaceId,
      apiUrl: request.url,
    });

    const errorResponse = getErrorResponseFromStorageError(error, { fileName });
    return errorResponse;
  }

  await logFileDeletion({
    status: "success",
    accessType,
    userId: session?.user?.id,
    workspaceId: resolved.workspaceId,
    apiUrl: request.url,
  });

  return responses.successResponse("File deleted successfully");
};
