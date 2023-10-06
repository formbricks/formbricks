import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { getFileFromLocalStorage, getFileFromS3 } from "@formbricks/lib/storage/service";
import path from "path";
import { env } from "@/env.mjs";
import { ZFileName } from "@formbricks/types/v1/storage";
import { responses } from "@/lib/api/response";
import { UPLOADS_DIR } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";

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

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);

  if (!isUserAuthorized) {
    return responses.unauthorizedResponse();
  }

  return await getFile();
}
