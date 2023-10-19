import { env } from "@/env.mjs";
import { responses } from "@/app/lib/api/response";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getSignedUrlForS3Upload } from "@formbricks/lib/storage/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { NextRequest, NextResponse } from "next/server";
import { generateSignedUrl } from "@formbricks/lib/crypto";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { fileName, contentType, surveyId } = await req.json();

  if (!surveyId) {
    return responses.badRequestResponse("surveyId ID is required");
  }

  if (!fileName) {
    return responses.badRequestResponse("fileName is required");
  }

  if (!contentType) {
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

  // const { plan } = team;

  // const buffer = Buffer.from(fileBuffer);

  // const bufferBytes = buffer.byteLength;
  // const bufferKB = bufferBytes / 1024;

  // if (plan === "free" && bufferKB > 10240) {
  //   return responses.badRequestResponse("Maximum file size for free plan is 10MB, please upgrade your plan");
  // }

  // if (plan === "pro" && bufferKB > 1024 * 1024) {
  //   return responses.badRequestResponse("Maximum file size for pro plan is 1GB");
  // }

  return await uploadPrivateFile(fileName, environmentId, contentType);
}

const uploadPrivateFile = async (fileName: string, environmentId: string, contentType: string) => {
  const accessType = "private"; // private files are only accessible by the user who has access to the environment
  // if s3 is not configured, we'll upload to a local folder named uploads

  if (!env.S3_ACCESS_KEY || !env.S3_SECRET_KEY || !env.S3_REGION || !env.S3_BUCKET_NAME) {
    try {
      const { signature, timestamp, uuid } = generateSignedUrl(fileName, environmentId, contentType);

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
      if (err.name === "FileTooLargeError") {
        return responses.badRequestResponse(err.message);
      }

      return responses.internalServerErrorResponse(err.message);
    }
  }

  try {
    const signedUrl = await getSignedUrlForS3Upload(fileName, contentType, accessType, environmentId);

    return responses.successResponse({
      signedUrl,
      fileUrl: new URL(`${WEBAPP_URL}/storage/${environmentId}/${accessType}/${fileName}`).href,
    });
  } catch (err) {
    if (err.name === "FileTooLargeError") {
      return responses.badRequestResponse(err.message);
    }

    return responses.internalServerErrorResponse(err.message);
  }
};
