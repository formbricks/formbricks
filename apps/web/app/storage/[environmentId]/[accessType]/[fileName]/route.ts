import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { authorizePrivateDownload } from "@/app/storage/[environmentId]/[accessType]/[fileName]/lib/auth";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { deleteFile, getSignedUrlForDownload } from "@/modules/storage/service";
import { getErrorResponseFromStorageError } from "@/modules/storage/utils";
import { getServerSession } from "next-auth";
import { type NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { TAccessType, ZDeleteFileRequest, ZDownloadFileRequest } from "@formbricks/types/storage";
import { logFileDeletion } from "./lib/audit-logs";

export const GET = async (
  request: NextRequest,
  props: { params: Promise<{ environmentId: string; accessType: TAccessType; fileName: string }> }
): Promise<Response> => {
  const params = await props.params;
  const paramValidation = ZDownloadFileRequest.safeParse(params);

  if (!paramValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(paramValidation.error),
      true
    );
  }

  const { environmentId, accessType, fileName } = paramValidation.data;

  // check auth
  if (accessType === "private") {
    const authResult = await authorizePrivateDownload(request, environmentId, "GET");
    if (!authResult.ok) {
      return authResult.error.unauthorized
        ? responses.unauthorizedResponse()
        : responses.notAuthenticatedResponse();
    }
  }

  const signedUrlResult = await getSignedUrlForDownload(fileName, environmentId, accessType);

  if (!signedUrlResult.ok) {
    const errorResponse = getErrorResponseFromStorageError(signedUrlResult.error, { fileName });
    return errorResponse;
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: signedUrlResult.data,
      "Cache-Control":
        accessType === "private"
          ? "no-store, no-cache, must-revalidate"
          : "public, max-age=300, s-maxage=300, stale-while-revalidate=300",
    },
  });
};

export const DELETE = async (
  request: NextRequest,
  props: { params: Promise<{ environmentId: string; accessType: string; fileName: string }> }
): Promise<Response> => {
  const params = await props.params;
  const paramValidation = ZDeleteFileRequest.safeParse(params);
  if (!paramValidation.success) {
    const errorDetails = transformErrorToDetails(paramValidation.error);

    await logFileDeletion({
      failureReason: "Parameter validation failed",
      environmentId: params.environmentId,
      apiUrl: request.url,
    });

    return responses.badRequestResponse("Fields are missing or incorrectly formatted", errorDetails, true);
  }

  const { environmentId, accessType, fileName } = paramValidation.data;

  const session = await getServerSession(authOptions);

  const authResult = await authorizePrivateDownload(request, environmentId, "DELETE");

  if (!authResult.ok) {
    await logFileDeletion({
      failureReason: authResult.error.unauthorized
        ? "User not authorized to access environment"
        : "User not authenticated",
      accessType,
      environmentId,
      apiUrl: request.url,
    });

    return authResult.error.unauthorized
      ? responses.unauthorizedResponse()
      : responses.notAuthenticatedResponse();
  }

  if (authResult.ok) {
    try {
      if (authResult.data.authType === "apiKey") {
        await applyRateLimit(rateLimitConfigs.storage.delete, authResult.data.hashedApiKey);
      } else {
        await applyRateLimit(rateLimitConfigs.storage.delete, authResult.data.userId);
      }
    } catch (error) {
      return responses.tooManyRequestsResponse(error.message);
    }
  }

  const deleteResult = await deleteFile(environmentId, accessType, decodeURIComponent(fileName));

  const isSuccess = deleteResult.ok;

  if (!isSuccess) {
    logger.error({ error: deleteResult.error }, "Error deleting file");

    await logFileDeletion({
      failureReason: deleteResult.error.code,
      accessType,
      userId: session?.user?.id,
      environmentId,
      apiUrl: request.url,
    });

    const errorResponse = getErrorResponseFromStorageError(deleteResult.error, { fileName });
    return errorResponse;
  }

  await logFileDeletion({
    status: "success",
    accessType,
    userId: session?.user?.id,
    environmentId,
    apiUrl: request.url,
  });

  return responses.successResponse("File deleted successfully");
};
