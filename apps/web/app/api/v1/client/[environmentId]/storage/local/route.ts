// headers -> "Content-Type" should be present and set to a valid MIME type
// body -> should be a valid file object (buffer)
// method -> PUT (to be the same as the signedUrl method)
import { responses } from "@/app/lib/api/response";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { putFileToLocalStorage } from "@formbricks/lib/storage/service";
import { UPLOADS_DIR } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env.mjs";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { validateLocalSignedUrl } from "@formbricks/lib/crypto";

interface Context {
  params: {
    environmentId: string;
  };
}

export async function POST(req: NextRequest, context: Context): Promise<NextResponse> {
  const environmentId = context.params.environmentId;

  const accessType = "private"; // private files are accessible only by authorized users
  const headersList = headers();

  const fileType = headersList.get("fileType");
  const fileName = headersList.get("fileName");
  const surveyId = headersList.get("surveyId");

  const signedSignature = headersList.get("signature");
  const signedUuid = headersList.get("uuid");
  const signedTimestamp = headersList.get("timestamp");

  if (!fileType) {
    return responses.badRequestResponse("contentType is required");
  }

  if (!fileName) {
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

  const [survey, team] = await Promise.all([getSurvey(surveyId), getTeamByEnvironmentId(environmentId)]);

  if (!survey) {
    return responses.notFoundResponse("Survey", surveyId);
  }

  if (!team) {
    return responses.notFoundResponse("TeamByEnvironmentId", environmentId);
  }

  // validate signature

  const validated = validateLocalSignedUrl(
    signedUuid,
    fileName,
    environmentId,
    fileType,
    Number(signedTimestamp),
    signedSignature,
    env.ENCRYPTION_KEY
  );

  if (!validated) {
    return responses.unauthorizedResponse();
  }

  const formData = await req.formData();
  const file = formData.get("file") as unknown as File;

  if (!file) {
    return responses.badRequestResponse("fileBuffer is required");
  }

  try {
    const plan = team.billing.features.linkSurvey.status in ["active", "canceled"] ? "pro" : "free";
    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    await putFileToLocalStorage(fileName, fileBuffer, accessType, environmentId, UPLOADS_DIR, false, plan);

    return responses.successResponse({
      message: "File uploaded successfully",
    });
  } catch (err) {
    if (err.name === "FileTooLargeError") {
      return responses.badRequestResponse(err.message);
    }
    return responses.internalServerErrorResponse("File upload failed");
  }
}
