import { responses } from "@/app/lib/api/response";
import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  let path: string;
  const packageRequested = params["package"];

  switch (packageRequested) {
    case "surveys":
      path = `../../packages/surveys/dist/index.umd.js`;
      break;
    case "js-core":
      const format = ["umd", "iife"].includes(req.nextUrl.searchParams.get("format")!)
        ? req.nextUrl.searchParams.get("format")!
        : "umd";
      path = `../../packages/js-core/dist/index.${format}.js`;
      break;
    default:
      return responses.badRequestResponse(
        "unknown module requested. module must be of type 'js-core' or 'surveys'"
      );
  }

  try {
    const packageSrcCode = await fs.readFile(path, "utf-8");
    return new NextResponse(packageSrcCode, {
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "public, s-maxage=600, max-age=1800, stale-while-revalidate=600, stale-if-error=600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return responses.internalServerErrorResponse("file not found");
  }
}
