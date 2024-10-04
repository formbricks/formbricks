import { responses } from "@/app/lib/api/response";
import fs from "fs/promises";
import { NextRequest } from "next/server";

export const GET = async (_: NextRequest, { params }: { params: { package: string } }) => {
  let path: string;
  const packageRequested = params.package;

  switch (packageRequested) {
    case "app":
      path = `../../packages/js-core/dist/app.umd.cjs`;
      break;
    case "website":
      path = `../../packages/js-core/dist/website.umd.cjs`;
      break;
    case "surveys":
      path = `../../packages/surveys/dist/index.umd.cjs`;
      break;
    default:
      return responses.notFoundResponse(
        "package",
        packageRequested,
        true,
        "public, max-age=3600, s-maxage=604800, stale-while-revalidate=3600, stale-if-error=3600"
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
        "public, max-age=3600, s-maxage=604800, stale-while-revalidate=3600, stale-if-error=3600"
      );
    } else {
      console.error("Error reading file:", error);
      return responses.internalServerErrorResponse(
        "internal server error",
        true,
        "public, max-age=3600, s-maxage=604800, stale-while-revalidate=3600, stale-if-error=3600"
      );
    }
  }
};
