import { responses } from "@/app/lib/api/response";
import { notFound } from "next/navigation";
import path from "node:path";
import { UPLOADS_DIR, isS3Configured } from "@formbricks/lib/constants";
import { getLocalFile, getS3File } from "@formbricks/lib/storage/service";

export const getFile = async (
  environmentId: string,
  accessType: string,
  fileName: string
): Promise<Response> => {
  if (!isS3Configured()) {
    try {
      const { fileBuffer, metaData } = await getLocalFile(
        path.join(UPLOADS_DIR, environmentId, accessType, fileName)
      );

      return new Response(fileBuffer, {
        headers: {
          "Content-Type": metaData.contentType,
          "Content-Disposition": "attachment",
          "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=300",
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
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=300",
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "NoSuchKey") {
      return responses.notFoundResponse("File not found", fileName);
    }
    return responses.internalServerErrorResponse("Internal server error");
  }
};
