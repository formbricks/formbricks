import { responses } from "@/app/lib/api/response";
import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";

import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";

export async function GET(req: NextRequest) {
  let path: string;
  let append = "";
  switch (req.nextUrl.searchParams.get("module")) {
    case "widget":
      path = `../../packages/surveys/dist/index.umd.js`;
      break;
    case "question-date":
      path = `../../packages/surveys/dist/question-date.umd.js`;
      break;
    case null:
      const format = ["umd", "iife"].includes(req.nextUrl.searchParams.get("format")!)
        ? req.nextUrl.searchParams.get("format")!
        : "umd";
      path = `../../packages/js/dist/index.${format}.js`;
      append = await handleInit(req);
      break;
    default:
      return responses.badRequestResponse("unknown module requested");
  }

  try {
    const jsCode = await loadAndAppendCode(path, append);

    return new NextResponse(jsCode, {
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

async function handleInit(req: NextRequest) {
  const environmentId = req.nextUrl.searchParams.get("environmentId");

  if (environmentId) {
    const environment = await getEnvironment(environmentId);

    if (environment) {
      const enableDebug =
        req.nextUrl.searchParams.get("debug") === "true" || req.nextUrl.searchParams.get("debug") === "1";
      return `formbricks.init({environmentId: "${environmentId}", apiHost: "${WEBAPP_URL}", debug: ${enableDebug}});`;
    }
  }
  return "";
}

async function loadAndAppendCode(path: string, append: string): Promise<string> {
  let jsCode = await fs.readFile(path, "utf-8");

  return jsCode + append;
}
