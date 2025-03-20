// headers -> "Content-Type" should be present and set to a valid MIME type
// body -> should be a valid file object (buffer)
// method -> PUT (to be the same as the signedUrl method)
import { responses } from "@/app/lib/api/response";
import { getBiggerUploadFileSizePermission } from "@/modules/ee/license-check/lib/utils";
import { NextRequest } from "next/server";
import { ENCRYPTION_KEY, UPLOADS_DIR } from "@formbricks/lib/constants";
import { validateLocalSignedUrl } from "@formbricks/lib/crypto";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { putFileToLocalStorage } from "@formbricks/lib/storage/service";
import { getSurvey } from "@formbricks/lib/survey/service";

interface Context {
  params: Promise<{
    environmentId: string;
  }>;
}

export const OPTIONS = async (): Promise<Response> => {
  return Response.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
};

export const POST = async (req: NextRequest, context: Context): Promise<Response> => {
  if (!ENCRYPTION_KEY) {
    return responses.internalServerErrorResponse("Encryption key is not set");
  }
  const params = await context.params;
  const environmentId = params.environmentId;

  const accessType = "private"; // private files are accessible only by authorized users

  const formData = await req.json();
  const fileType = formData.fileType as string;
  const encodedFileName = formData.fileName as string;
  const surveyId = formData.surveyId as string;
  const signedSignature = formData.signature as string;
  const signedUuid = formData.uuid as string;
  const signedTimestamp = formData.timestamp as string;

  if (!fileType) {
    return responses.badRequestResponse("contentType is required");
  }

  if (!encodedFileName) {
    return responses.badRequestResponse("fileName is required");
  }

  if (!surveyId) {
    return responses.badRequestResponse("surveyId is required");
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

  const [survey, organization] = await Promise.all([
    getSurvey(surveyId),
    getOrganizationByEnvironmentId(environmentId),
  ]);

  if (!survey) {
    return responses.notFoundResponse("Survey", surveyId);
  }

  if (!organization) {
    return responses.notFoundResponse("OrganizationByEnvironmentId", environmentId);
  }

  const fileName = decodeURIComponent(encodedFileName);

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

  const base64String = formData.fileBase64String as string;

  const buffer = Buffer.from(base64String.split(",")[1], "base64");
  const file = new Blob([buffer], { type: fileType });

  if (!file) {
    return responses.badRequestResponse("fileBuffer is required");
  }

  try {
    const isBiggerFileUploadAllowed = await getBiggerUploadFileSizePermission(organization.billing.plan);
    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    await putFileToLocalStorage(
      fileName,
      fileBuffer,
      accessType,
      environmentId,
      UPLOADS_DIR,
      isBiggerFileUploadAllowed
    );

    return responses.successResponse({
      message: "File uploaded successfully",
    });
  } catch (err) {
    console.error("err: ", err);
    if (err.name === "FileTooLargeError") {
      return responses.badRequestResponse(err.message);
    }
    return responses.internalServerErrorResponse("File upload failed");
  }
};
