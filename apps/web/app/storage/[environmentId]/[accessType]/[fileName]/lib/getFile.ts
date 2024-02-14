import { responses } from "@/app/lib/api/response";
import { notFound } from "next/navigation";
import path from "path";

import { IS_S3_CONFIGURED, UPLOADS_DIR } from "@formbricks/lib/constants";
import { getLocalFile, getS3File } from "@formbricks/lib/storage/service";

const getFile = async (environmentId: string, accessType: string, fileName: string) => {
  if (!IS_S3_CONFIGURED) {
    try {
      const { fileBuffer, metaData } = await getLocalFile(
        path.join(UPLOADS_DIR, environmentId, accessType, fileName)
      );

      return new Response(fileBuffer, {
        headers: {
          "Content-Type": metaData.contentType,
          "Content-Disposition": "attachment",
        },
      });
    } catch (err) {
      notFound();
    }
  }

  try {
    const signedUrl = await getS3File(`${environmentId}/${accessType}/${fileName}`);

    return new Response(null, {
      status: 302,
      headers: {
        Location: signedUrl,
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

export default getFile;
