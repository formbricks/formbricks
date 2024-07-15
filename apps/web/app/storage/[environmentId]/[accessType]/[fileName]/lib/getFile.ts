import { responses } from "@/app/lib/api/response";
import { notFound } from "next/navigation";
import path from "path";
import { UPLOADS_DIR } from "@formbricks/lib/constants";
import { isS3Configured } from "@formbricks/lib/constants";
import { getLocalFile, getS3File } from "@formbricks/lib/storage/service";

export const getFile = async (environmentId: string, accessType: string, fileName: string) => {
  if (!isS3Configured()) {
    try {
      const { fileBuffer, metaData } = await getLocalFile(
        path.join(UPLOADS_DIR, environmentId, accessType, fileName)
      );

      return new Response(fileBuffer, {
        headers: {
          "Content-Type": metaData.contentType,
          "Content-Disposition": "attachment",
          "Cache-Control": "public, max-age=1200, s-maxage=1200, stale-while-revalidate=300",
          Vary: "Accept-Encoding",
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
        // public file, cache for one hour, private file, cache for 10 minutes
        "Cache-Control": `public, max-age=${accessType === "public" ? 3600 : 600}, s-maxage=3600, stale-while-revalidate=300`,
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
