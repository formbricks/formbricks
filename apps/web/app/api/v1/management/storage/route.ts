import { logger } from "@formbricks/logger";
import { ZUploadPublicFileRequest } from "@formbricks/types/storage";
import { resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { checkAuth } from "@/app/api/v1/management/storage/lib/utils";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getFileAuditTargetId } from "@/app/storage/[workspaceId]/[accessType]/[...filePath]/lib/audit-logs";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getSignedUrlForUpload } from "@/modules/storage/service";
import { getErrorResponseFromStorageError } from "@/modules/storage/utils";

// api endpoint for getting a signed url for uploading a public file
// uploaded files will be public, anyone can access the file
// uploading public files requires authentication
// use this to get a signed url for uploading a public file for a specific resource, e.g. a survey's background image

export const POST = withV1ApiWrapper({
  handler: async ({ req, authentication, auditLog }) => {
    let storageInput;

    try {
      storageInput = await parseJsonBodyWithLimit<Record<string, unknown>>(req);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return {
          response: responses.payloadTooLargeResponse("Payload Too Large", { error: error.message }),
        };
      }

      logger.error({ error, url: req.url }, "Error parsing JSON input");
      return {
        response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
      };
    }

    // Accept workspaceId
    if (authentication && "apiKeyId" in authentication) {
      // API key auth: resolveBodyIds handles resolution + permission check
      const resolved = await resolveBodyIds(storageInput, authentication, "POST");
      if (!resolved.ok) return { response: resolved.response };
      storageInput = resolved.body;
    } else if (!storageInput.workspaceId) {
      return { response: responses.badRequestResponse("workspaceId must be provided") };
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

    const { fileName, fileType, workspaceId } = parsedInputResult.data;

    // Attribute the event before authorization so a denied caller is recorded too. API keys already carry
    // their organization from the wrapper; a session user's is resolved from the workspace.
    if (auditLog) {
      auditLog.targetId = `${workspaceId}:public`;
      if (authentication && "user" in authentication) {
        auditLog.userType = "user";
        auditLog.organizationId = await getOrganizationIdFromWorkspaceId(workspaceId).catch(
          () => auditLog.organizationId
        );
      }
    }

    const authResponse = await checkAuth(authentication, workspaceId);
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

    if (auditLog) {
      // Metadata only: never the signed URL or its presigned fields.
      auditLog.targetId = getFileAuditTargetId(
        workspaceId,
        "public",
        signedUrlResponse.data.fileUrl.split("/").pop() ?? ""
      );
      auditLog.newObject = { workspaceId, accessType: "public", fileType };
    }

    return {
      response: responses.successResponse(signedUrlResponse.data),
    };
  },
  action: "created",
  targetType: "file",
  customRateLimitConfig: rateLimitConfigs.storage.upload,
});
