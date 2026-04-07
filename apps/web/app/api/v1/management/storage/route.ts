import { logger } from "@formbricks/logger";
import { ZUploadPublicFileRequest } from "@formbricks/types/storage";
import {
  getProductionEnvironmentIdByWorkspaceId,
  resolveBodyIds,
} from "@/app/api/v1/management/lib/workspace-resolver";
import { checkAuth } from "@/app/api/v1/management/storage/lib/utils";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getWorkspaceIdFromEnvironmentId } from "@/lib/utils/helper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getSignedUrlForUpload } from "@/modules/storage/service";
import { getErrorResponseFromStorageError } from "@/modules/storage/utils";

// api endpoint for getting a signed url for uploading a public file
// uploaded files will be public, anyone can access the file
// uploading public files requires authentication
// use this to get a signed url for uploading a public file for a specific resource, e.g. a survey's background image

export const POST = withV1ApiWrapper({
  handler: async ({ req, authentication }) => {
    let storageInput;

    try {
      storageInput = await req.json();
    } catch (error) {
      logger.error({ error, url: req.url }, "Error parsing JSON input");
      return {
        response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
      };
    }

    // Accept workspaceId as alternative to environmentId
    if (authentication && "apiKeyId" in authentication) {
      // API key auth: resolveBodyIds handles resolution + permission check
      const resolved = await resolveBodyIds(storageInput, authentication.environmentPermissions, "POST");
      if (!resolved.ok) return { response: resolved.response };
      storageInput = resolved.body;
    } else if (storageInput.workspaceId && !storageInput.environmentId) {
      // Session auth with workspaceId only: resolve environmentId
      if (typeof storageInput.workspaceId !== "string") {
        return { response: responses.badRequestResponse("workspaceId must be a string") };
      }
      const envId = await getProductionEnvironmentIdByWorkspaceId(storageInput.workspaceId);
      if (!envId) {
        return { response: responses.notFoundResponse("Workspace", storageInput.workspaceId) };
      }
      storageInput = { ...storageInput, environmentId: envId };
    } else if (storageInput.environmentId && !storageInput.workspaceId) {
      // Session auth with environmentId only (current UI): resolve workspaceId
      if (typeof storageInput.environmentId !== "string") {
        return { response: responses.badRequestResponse("environmentId must be a string") };
      }
      try {
        const wsId = await getWorkspaceIdFromEnvironmentId(storageInput.environmentId);
        storageInput = { ...storageInput, workspaceId: wsId };
      } catch {
        return { response: responses.notFoundResponse("Environment", storageInput.environmentId) };
      }
    }

    const parsedInputResult = ZUploadPublicFileRequest.safeParse(storageInput);

    if (!parsedInputResult.success) {
      const errorDetails = transformErrorToDetails(parsedInputResult.error);

      logger.error({ error: errorDetails }, "Fields are missing or incorrectly formatted");

      return {
        response: responses.badRequestResponse(
          "Fields are missing or incorrectly formatted",
          errorDetails,
          true
        ),
      };
    }

    const { fileName, fileType, environmentId, workspaceId } = parsedInputResult.data;

    const authResponse = await checkAuth(authentication, environmentId);
    if (authResponse) {
      return {
        response: authResponse,
      };
    }

    const MAX_PUBLIC_FILE_SIZE_MB = 5;
    const maxFileUploadSize = MAX_PUBLIC_FILE_SIZE_MB * 1024 * 1024;

    const signedUrlResponse = await getSignedUrlForUpload(
      fileName,
      workspaceId,
      fileType,
      "public",
      maxFileUploadSize
    );

    if (!signedUrlResponse.ok) {
      logger.error({ error: signedUrlResponse.error }, "Error getting signed url for upload");
      const errorResponse = getErrorResponseFromStorageError(signedUrlResponse.error, { fileName });
      return {
        response: errorResponse,
      };
    }

    return {
      response: responses.successResponse(signedUrlResponse.data),
    };
  },
  customRateLimitConfig: rateLimitConfigs.storage.upload,
});
