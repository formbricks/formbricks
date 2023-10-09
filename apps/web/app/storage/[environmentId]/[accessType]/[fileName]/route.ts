import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { env } from "@/env.mjs";
import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { UPLOADS_DIR } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getFileFromLocalStorage, getFileFromS3 } from "@formbricks/lib/storage/service";
import { ZStorageRetrievalParams } from "@formbricks/types/v1/storage";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { NextRequest } from "next/server";
import path from "path";

export async function GET(
  _: NextRequest,
  { params }: { params: { environmentId: string; accessType: string; fileName: string } }
) {
  const paramValidation = ZStorageRetrievalParams.safeParse(params);

  if (!paramValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(paramValidation.error),
      true
    );
  }

  const { environmentId, accessType, fileName } = params;

  const getFile = async () => {
    if (!env.AWS_ACCESS_KEY || !env.AWS_SECRET_KEY || !env.S3_REGION || !env.S3_BUCKET_NAME) {
      try {
        const { fileBuffer, metaData } = await getFileFromLocalStorage(
          path.join(UPLOADS_DIR, environmentId, accessType, fileName)
        );

        return new Response(fileBuffer, {
          headers: {
            "Content-Type": metaData.contentType,
            "Content-Disposition": "inline",
          },
        });
      } catch (err) {
        notFound();
      }
    }

    try {
      const { fileBuffer, metaData } = await getFileFromS3(`${environmentId}/${accessType}/${fileName}`);

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
