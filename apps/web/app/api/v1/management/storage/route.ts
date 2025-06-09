import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { validateFile } from "@/lib/fileValidation";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { getSignedUrlForPublicFile } from "./lib/getSignedUrl";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

// api endpoint for uploading public files
// uploaded files will be public, anyone can access the file
// uploading public files requires authentication
// use this to upload files for a specific resource, e.g. a user profile picture or a survey
// this api endpoint will return a signed url for uploading the file to s3 and another url for uploading file to the local storage

export const POST = async (request: NextRequest): Promise<Response> => {
  let storageInput;

  try {
    storageInput = await request.json();
  } catch (error) {
    logger.error({ error, url: request.url }, "Error parsing JSON input");
    return responses.badRequestResponse("Malformed JSON input, please check your request body");
  }

  const { fileName, fileType, environmentId, allowedFileExtensions } = storageInput;

  if (!fileName) {
    return responses.badRequestResponse("fileName is required");
  }

  if (!fileType) {
    return responses.badRequestResponse("fileType is required");
  }

  if (!environmentId) {
    return responses.badRequestResponse("environmentId is required");
  }

  const session = await getServerSession(authOptions);

  if (!session) {
    //check whether its using API key
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
      return responses.unauthorizedResponse();
    }
  } else {
    const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
    if (!isUserAuthorized) {
      return responses.unauthorizedResponse();
    }
  }

  // Perform server-side file validation first to block dangerous file types
  const fileValidation = validateFile(fileName, fileType);
  if (!fileValidation.valid) {
    return responses.badRequestResponse(fileValidation.error ?? "Invalid file type");
  }

  // Also perform client-specified allowed file extensions validation if provided
  if (allowedFileExtensions?.length) {
    const fileExtension = fileName.split(".").pop()?.toLowerCase();
    if (!fileExtension || !allowedFileExtensions.includes(fileExtension)) {
      return responses.badRequestResponse(
        `File extension is not allowed, allowed extensions are: ${allowedFileExtensions.join(", ")}`
      );
    }
  }

  return await getSignedUrlForPublicFile(fileName, environmentId, fileType);
};
