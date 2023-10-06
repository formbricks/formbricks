import { responses } from "@/lib/api/response";
import { NextRequest } from "next/server";
import { env } from "@/env.mjs";
import { putFileToLocalStorage, putFileToS3 } from "@formbricks/lib/storage/service";
import { UPLOADS_DIR, WEBAPP_URL } from "@formbricks/lib/constants";
import { prisma } from "@formbricks/database";

export async function POST(req: NextRequest) {
  const accessType = "private"; // private files are only accessible by the user who has access to the environment
  const { fileName, fileType, fileBuffer, responseId } = await req.json();

  if (!responseId) {
    return responses.badRequestResponse("response ID is required");
  }

  if (!fileName) {
    return responses.badRequestResponse("fileName is required");
  }

  if (!fileType) {
    return responses.badRequestResponse("fileType is required");
  }

  if (!fileBuffer) {
    return responses.badRequestResponse("no file provided, fileBuffer is required");
  }

  const response = await prisma.response.findUnique({
    where: {
      id: responseId,
    },
  });

  if (!response) {
    return responses.notFoundResponse("Response", responseId);
  }

  const survey = await prisma.survey.findUnique({
    where: {
      id: response.surveyId,
    },
  });

  if (!survey) {
    return responses.notFoundResponse("Survey", response.surveyId);
  }

  const { environmentId } = survey;

  const environment = await prisma.environment.findUnique({
    where: { id: environmentId },
    include: {
      product: {
        select: {
          team: {
            select: {
              plan: true,
            },
          },
        },
      },
    },
  });

  if (!environment) {
    return responses.notFoundResponse("Environment", environmentId);
  }

  const { plan } = environment.product.team;

  const buffer = Buffer.from(fileBuffer);

  const bufferBytes = buffer.byteLength;
  const bufferKB = bufferBytes / 1024;

  if (plan === "free" && bufferKB > 10240) {
    return responses.badRequestResponse("Maximum file size for free plan is 10MB, please upgrade your plan");
  }

  if (plan === "pro" && bufferKB > 1024 * 1024) {
    return responses.badRequestResponse("Maximum file size for pro plan is 1GB");
  }

  const uploadPrivateFile = async () => {
    // if s3 is not configured, we'll upload to a local folder named uploads

    if (!env.AWS_ACCESS_KEY || !env.AWS_SECRET_KEY || !env.S3_REGION || !env.S3_BUCKET_NAME) {
      try {
        await putFileToLocalStorage(fileName, fileBuffer, accessType, environmentId, UPLOADS_DIR);

        const uploadedFileName = `${environmentId}/${accessType}/${fileName}`;

        return responses.successResponse({
          uploaded: true,
          url: `${WEBAPP_URL}/api/storage?fileName=${uploadedFileName}`,
        });
      } catch (err) {
        if (err.name === "FileTooLargeError") {
          return responses.badRequestResponse(err.message);
        }

        return responses.internalServerErrorResponse(err.message);
      }
    }

    try {
      await putFileToS3(fileName, fileType, fileBuffer, accessType, environmentId);

      const uploadedFileName = `${environmentId}/${accessType}/${fileName}`;

      return responses.successResponse({
        uploaded: true,
        url: `${WEBAPP_URL}/api/storage?fileName=${uploadedFileName}`,
      });
    } catch (err) {
      if (err.name === "FileTooLargeError") {
        return responses.badRequestResponse(err.message);
      }

      return responses.internalServerErrorResponse(err.message);
    }
  };

  return await uploadPrivateFile();
}
