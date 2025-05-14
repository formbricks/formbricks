// headers -> "Content-Type" should be present and set to a valid MIME type
// body -> should be a valid file object (buffer)
// method -> PUT (to be the same as the signedUrl method)
import { responses } from "@/app/lib/api/response";
import { ENCRYPTION_KEY, UPLOADS_DIR } from "@/lib/constants";
import { validateLocalSignedUrl } from "@/lib/crypto";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { validateFile } from "@/lib/fileValidation";
import { putFileToLocalStorage } from "@/lib/storage/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";

export const POST = async (req: NextRequest): Promise<Response> => {
  if (!ENCRYPTION_KEY) {
    return responses.internalServerErrorResponse("Encryption key is not set");
  }

  const accessType = "public"; // public files are accessible by anyone

  const jsonInput = await req.json();
  const fileType = jsonInput.fileType as string;
  const encodedFileName = jsonInput.fileName as string;
  const signedSignature = jsonInput.signature as string;
  const signedUuid = jsonInput.uuid as string;
  const signedTimestamp = jsonInput.timestamp as string;
  const environmentId = jsonInput.environmentId as string;

  if (!environmentId) {
    return responses.badRequestResponse("environmentId is required");
  }

  if (!fileType) {
    return responses.badRequestResponse("contentType is required");
  }

  if (!encodedFileName) {
    return responses.badRequestResponse("fileName is required");
  }

  if (!signedSignature) {
    return responses.unauthorizedResponse();
  }

  if (!signedUuid) {
    return responses.unauthorizedResponse();
  }

  if (!signedTimestamp) {
    return responses.unauthorizedResponse();
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return responses.notAuthenticatedResponse();
  }

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);

  if (!isUserAuthorized) {
    return responses.unauthorizedResponse();
  }

  const fileName = decodeURIComponent(encodedFileName);

  // Perform server-side file validation
  const fileValidation = validateFile(fileName, fileType);
  if (!fileValidation.valid) {
    return responses.badRequestResponse(fileValidation.error ?? "Invalid file");
  }

  // validate signature

  const validated = validateLocalSignedUrl(
    signedUuid,
    fileName,
    environmentId,
    fileType,
    Number(signedTimestamp),
    signedSignature,
    ENCRYPTION_KEY
  );

  if (!validated) {
    return responses.unauthorizedResponse();
  }

  const base64String = jsonInput.fileBase64String as string;
  const buffer = Buffer.from(base64String.split(",")[1], "base64");
  const file = new Blob([buffer], { type: fileType });

  if (!file) {
    return responses.badRequestResponse("fileBuffer is required");
  }

  try {
    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    await putFileToLocalStorage(fileName, fileBuffer, accessType, environmentId, UPLOADS_DIR);

    return responses.successResponse({
      message: "File uploaded successfully",
    });
  } catch (err) {
    logger.error(err, "Error uploading file");
    if (err.name === "FileTooLargeError") {
      return responses.badRequestResponse(err.message);
    }
    return responses.internalServerErrorResponse("File upload failed");
  }
};
