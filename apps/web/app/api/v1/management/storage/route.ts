import { responses } from "@/app/lib/api/response";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env.mjs";
import { putFileToLocalStorage, putFileToS3 } from "@formbricks/lib/storage/service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { UPLOADS_DIR, WEBAPP_URL } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";

// api endpoint for uploading public files
// uploaded files will be public, anyone can access the file
// uploading public files requires authentication
// use this to upload files for a specific resource, e.g. a user profile picture or a survey

export async function POST(req: NextRequest): Promise<NextResponse> {
  const accessType = "public"; // public files are accessible by anyone
  const { fileName, contentType, environmentId, fileBuffer, allowedFileExtensions } = await req.json();

  if (!fileName) {
    return responses.badRequestResponse("fileName is required");
  }

  if (!contentType) {
    return responses.badRequestResponse("contentType is required");
  }

  if (!fileBuffer) {
    return responses.badRequestResponse("no file provided, fileBuffer is required");
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

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);

  if (!isUserAuthorized) {
    return responses.unauthorizedResponse();
  }

  return await uploadPublicFile(fileName, fileBuffer, accessType, environmentId, contentType);
}

const uploadPublicFile = async (
  fileName: string,
  fileBuffer: Buffer,
  accessType: "public" | "private",
  environmentId,
  contentType?: string
) => {
  // if s3 is not configured, we'll upload to a local folder named uploads

  const url = new URL(`${WEBAPP_URL}/storage/${environmentId}/${accessType}/${fileName}`);

  if (!env.AWS_ACCESS_KEY || !env.AWS_SECRET_KEY || !env.S3_REGION || !env.S3_BUCKET_NAME) {
    try {
      await putFileToLocalStorage(fileName, fileBuffer, accessType, environmentId, UPLOADS_DIR, true);

      return responses.successResponse({
        uploaded: true,
        url: url.href,
      });
    } catch (err) {
      if (err.name === "FileTooLargeError") {
        return responses.badRequestResponse(err.message);
      }

      return responses.internalServerErrorResponse("Internal server error");
    }
  }

  try {
    if (!contentType) {
      return responses.badRequestResponse("contentType is required");
    }

    await putFileToS3(fileName, contentType, fileBuffer, accessType, environmentId, true);

    return responses.successResponse({
      uploaded: true,
      url: url.href
    });
  } catch (err) {
    if (err.name === "FileTooLargeError") {
      return responses.badRequestResponse(err.message);
    }

    return responses.internalServerErrorResponse("Internal server error");
  }
};
