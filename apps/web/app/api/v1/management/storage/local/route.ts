// headers -> "Content-Type" should be present and set to a valid MIME type
// body -> should be a valid file object (buffer)
// method -> PUT (to be the same as the signedUrl method)
import { responses } from "@/app/lib/api/response";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { putFileToLocalStorage } from "@formbricks/lib/storage/service";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { UPLOADS_DIR } from "@formbricks/lib/constants";
import { validateSignedUrl } from "@formbricks/lib/crypto";
import { ENCRYPTION_KEY } from "@formbricks/lib/constants";

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const accessType = "public"; // public files are accessible by anyone
  const headersList = headers();
  const contentType = headersList.get("Content-Type");
  const fileName = headersList.get("fileName");
  const environmentId = headersList.get("environmentId");

  const signedSignature = headersList.get("signature");
  const signedUuid = headersList.get("uuid");
  const signedTimestamp = headersList.get("timestamp");

  if (!contentType) {
    return responses.badRequestResponse("contentType is required");
  }

  if (!fileName) {
    return responses.badRequestResponse("fileName is required");
  }

  if (!environmentId) {
    return responses.badRequestResponse("environmentId is required");
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

  // validate signature

  const validated = validateSignedUrl(
    signedUuid,
    fileName,
    environmentId,
    contentType,
    Number(signedTimestamp),
    signedSignature,
    ENCRYPTION_KEY
  );

  if (!validated) {
    return responses.unauthorizedResponse();
  }

  const file = req.body;

  if (!file) {
    return responses.badRequestResponse("fileBuffer is required");
  }

  try {
    let chunks: Uint8Array[] = [];
    for await (let chunk of file as any) {
      chunks.push(chunk);
    }

    const fileBuffer = Buffer.concat(chunks);

    await putFileToLocalStorage(fileName, fileBuffer, accessType, environmentId, UPLOADS_DIR, true);
    return responses.successResponse({
      message: "File uploaded successfully",
    });
  } catch (err) {
    console.log(`Error uploading file: ${err}`);
    return responses.internalServerErrorResponse("File upload failed");
  }
}
