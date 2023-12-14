// headers -> "Content-Type" should be present and set to a valid MIME type
// body -> should be a valid file object (buffer)
// method -> PUT (to be the same as the signedUrl method)
import { responses } from "@/app/lib/api/response";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { UPLOADS_DIR } from "@formbricks/lib/constants";
import { validateLocalSignedUrl } from "@formbricks/lib/crypto";
import { env } from "@formbricks/lib/env.mjs";
import { putFileToLocalStorage } from "@formbricks/lib/storage/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";

interface Context {
  params: {
    environmentId: string;
  };
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-File-Name, X-File-Type, X-Survey-ID, X-Signature, X-Timestamp, X-UUID",
      },
    }
  );
}

export async function POST(req: NextRequest, context: Context): Promise<NextResponse> {
  const environmentId = context.params.environmentId;

  const accessType = "private"; // private files are accessible only by authorized users
  const headersList = headers();

  const fileType = headersList.get("X-File-Type");
  const encodedFileName = headersList.get("X-File-Name");
  const surveyId = headersList.get("X-Survey-ID");

  const signedSignature = headersList.get("X-Signature");
  const signedUuid = headersList.get("X-UUID");
  const signedTimestamp = headersList.get("X-Timestamp");

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

  const [survey, team] = await Promise.all([getSurvey(surveyId), getTeamByEnvironmentId(environmentId)]);

  if (!survey) {
    return responses.notFoundResponse("Survey", surveyId);
  }

  if (!team) {
    return responses.notFoundResponse("TeamByEnvironmentId", environmentId);
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
