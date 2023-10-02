import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import {
  getFileFromLocalStorage,
  getFileFromS3,
  putFileToLocalStorage,
  putFileToS3,
} from "@formbricks/lib/services/storage";
import path from "path";
import { env } from "@/env.mjs";
import { ZAccessType, ZFileName } from "@formbricks/types/v1/storage";
import { responses } from "@/lib/api/response";

const UPLOADS_DIR = path.resolve("./uploads");

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  const fileName = searchParams.get("fileName");

  if (!fileName) {
    return responses.badRequestResponse("File name is required");
  }

  // parse the fileName to get the environmentId and accessType

  const fileNameParsed = ZFileName.safeParse(fileName);

  if (!fileNameParsed.success) {
    const error = fileNameParsed.error;

    if (error.issues[0].code === "custom") {
      return responses.badRequestResponse(error.issues[0].message);
    }

    return responses.badRequestResponse("Invalid file name, please check the format");
  }

  const fileNameParts = fileName.split("/");
  const environmentId = fileNameParts[0];
  const accessType = fileNameParts[1];
  const baseFileName = fileNameParts[2];

  const getFile = async () => {
    if (!env.AWS_ACCESS_KEY || !env.AWS_SECRET_KEY || !env.S3_REGION || !env.S3_BUCKET_NAME) {
      try {
        const { fileBuffer, metaData } = await getFileFromLocalStorage(
          path.join(UPLOADS_DIR, environmentId, accessType, baseFileName)
        );

        return new Response(fileBuffer, {
          headers: {
            "Content-Type": metaData.contentType,
            "Content-Disposition": "inline",
          },
        });
      } catch (err) {
        return responses.notFoundResponse("File not found", fileName);
      }
    }

    try {
      const { fileBuffer, metaData } = await getFileFromS3(fileName);

      return new Response(fileBuffer, {
        headers: {
          "Content-Type": metaData.contentType,
          "Content-Disposition": "inline",
        },
      });
    } catch (err) {
      if (err.name === "NoSuchKey") {
        return responses.notFoundResponse("File not found", fileName);
      } else {
        return responses.internalServerErrorResponse("Internal server error");
      }
    }
  };

  if (accessType === "public") {
    return await getFile();
  }

  // auth and download private file

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return responses.notAuthenticatedResponse();
  }

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user, environmentId);

  if (!isUserAuthorized) {
    return responses.unauthorizedResponse();
  }

  return await getFile();
}

export async function POST(req: NextRequest) {
  const {
    fileName,
    fileType,
    accessType = "private",
    environmentId,
    fileBuffer,
    allowedFileExtensions,
  } = await req.json();

  if (!fileName) {
    return responses.badRequestResponse("fileName is required");
  }

  if (!fileType) {
    return responses.badRequestResponse("fileType is required");
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

  // parse the accessType with zod
  if (!ZAccessType.safeParse(accessType).success) {
    return responses.badRequestResponse("Access type must be either 'public' or 'private'");
  }

  const uploadFile = async () => {
    // if s3 is not configured, we'll upload to a local folder named uploads

    if (!env.AWS_ACCESS_KEY || !env.AWS_SECRET_KEY || !env.S3_REGION || !env.S3_BUCKET_NAME) {
      try {
        await putFileToLocalStorage(fileName, fileBuffer, accessType, environmentId, UPLOADS_DIR);

        return responses.successResponse("File uploaded successfully");
      } catch (err) {
        if (err.name === "FileTooLargeError") {
          return responses.badRequestResponse(err.message);
        }

        return responses.internalServerErrorResponse("Internal server error");
      }
    }

    try {
      await putFileToS3(fileName, fileType, fileBuffer, accessType, environmentId);
      return responses.successResponse("File uploaded successfully");
    } catch (err) {
      if (err.name === "FileTooLargeError") {
        return responses.badRequestResponse(err.message);
      }

      return responses.internalServerErrorResponse("Internal server error");
    }
  };

  if (accessType === "public") {
    // dont auth and upload public file
    return await uploadFile();
  }

  // auth and upload private file

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return responses.notAuthenticatedResponse();
  }

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user, environmentId);

  if (!isUserAuthorized) {
    return responses.unauthorizedResponse();
  }

  return await uploadFile();
}
