import { env } from "@/env.mjs";
import { responses } from "@/app/lib/api/response";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getSignedUrlForS3Upload } from "@formbricks/lib/storage/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { NextRequest, NextResponse } from "next/server";
import { generateLocalSignedUrl } from "@formbricks/lib/crypto";

// api endpoint for uploading private files
// uploaded files will be private, only the user who has access to the environment can access the file
// uploading private files requires no authentication
// use this to let users upload files to a survey for example
// this api endpoint will return a signed url for uploading the file to s3 and another url for uploading file to the local storage

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { fileName, fileType, surveyId } = await req.json();

  if (!surveyId) {
    return responses.badRequestResponse("surveyId ID is required");
  }

  if (!fileName) {
    return responses.badRequestResponse("fileName is required");
  }

  if (!fileType) {
    return responses.badRequestResponse("contentType is required");
  }

  const survey = await getSurvey(surveyId);

  if (!survey) {
    return responses.notFoundResponse("Survey", surveyId);
  }

  const { environmentId } = survey;

  const team = await getTeamByEnvironmentId(environmentId);

  if (!team) {
    return responses.notFoundResponse("TeamByEnvironmentId", environmentId);
  }

  const { plan } = team;

  return await uploadPrivateFile(fileName, environmentId, fileType, plan);
}

const uploadPrivateFile = async (
  fileName: string,
  environmentId: string,
  fileType: string,
  plan: "free" | "pro"
) => {
  const accessType = "private"; // private files are only accessible by the user who has access to the environment
  // if s3 is not configured, we'll upload to a local folder named uploads

  if (!env.S3_ACCESS_KEY || !env.S3_SECRET_KEY || !env.S3_REGION || !env.S3_BUCKET_NAME) {
    try {
      const { signature, timestamp, uuid } = generateLocalSignedUrl(fileName, environmentId, fileType);

      return responses.successResponse({
        signedUrl: `${WEBAPP_URL}/api/v1/client/storage/local`,
        signingData: {
          signature,
          timestamp,
          uuid,
        },
        fileUrl: new URL(`${WEBAPP_URL}/storage/${environmentId}/${accessType}/${fileName}`).href,
      });
    } catch (err) {
      return responses.internalServerErrorResponse(err.message);
    }
  }

  try {
    const signedUrl = await getSignedUrlForS3Upload(
      fileName,
      fileType,
      accessType,
      environmentId,
      false,
      plan
    );

    return responses.successResponse({
      signedUrl,
      fileUrl: new URL(`${WEBAPP_URL}/storage/${environmentId}/${accessType}/${fileName}`).href,
    });
  } catch (err) {
    return responses.internalServerErrorResponse(err.message);
  }
};
