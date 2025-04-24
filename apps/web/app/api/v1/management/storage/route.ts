import { responses } from "@/app/lib/api/response";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { getSignedUrlForPublicFile } from "./lib/getSignedUrl";

// api endpoint for uploading public files
// uploaded files will be public, anyone can access the file
// uploading public files requires authentication
// use this to upload files for a specific resource, e.g. a user profile picture or a survey
// this api endpoint will return a signed url for uploading the file to s3 and another url for uploading file to the local storage

export const POST = async (req: NextRequest): Promise<Response> => {
  let storageInput;

  try {
    storageInput = await req.json();
  } catch (error) {
    logger.error({ error, url: req.url }, "Error parsing JSON input");
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

  if (allowedFileExtensions?.length) {
    const fileExtension = fileName.split(".").pop();
    if (!fileExtension || !allowedFileExtensions.includes(fileExtension)) {
      return responses.badRequestResponse(
        `File extension is not allowed, allowed extensions are: ${allowedFileExtensions.join(", ")}`
      );
    }
  }

  // auth and upload private file
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return responses.notAuthenticatedResponse();
  }

  return await getSignedUrlForPublicFile(fileName, environmentId, fileType);
};
