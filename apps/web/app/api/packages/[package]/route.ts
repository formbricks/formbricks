import { responses } from "@/app/lib/api/response";
import fs from "fs/promises";
import { NextRequest } from "next/server";

export const GET = async (_: NextRequest, { params }: { params: { package: string } }) => {
  let path: string;
  const packageRequested = params.package;

  switch (packageRequested) {
    case "js":
      path = `../../packages/js-core/dist/index.umd.cjs`;
      break;
    case "surveys":
      path = `../../packages/surveys/dist/index.umd.cjs`;
      break;
    default:
      return responses.notFoundResponse(
        "package",
        packageRequested,
        true,
        "public, max-age=600, s-maxage=600, stale-while-revalidate=600, stale-if-error=600" // 10 minutes cache for not found
      );
  }

  try {
    const packageSrcCode = await fs.readFile(path, "utf-8");
    return new Response(packageSrcCode, {
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control":
          "public, max-age=3600, s-maxage=604800, stale-while-revalidate=3600, stale-if-error=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return responses.notFoundResponse(
        "package",
        packageRequested,
        true,
        "public, max-age=600, s-maxage=600, stale-while-revalidate=600, stale-if-error=600" // 10 minutes cache for file not found errors
      );
    } else {
      console.error("Error reading file:", error);
      return responses.internalServerErrorResponse(
        "internal server error",
        true,
        "public, max-age=600, s-maxage=600, stale-while-revalidate=600, stale-if-error=600" // 10 minutes cache for internal errors
      );
    }
  }
};
