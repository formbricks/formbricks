import { responses } from "@/app/lib/api/response";
import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { TEnvironment } from "@formbricks/types/environment";

const printAllDirectories = async (dirPath = "../../../../../") => {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        console.log("Directory:", filePath);
        await printAllDirectories(filePath);
      }
    }
  } catch (error) {
    console.error("Error reading directory:", error);
  }
};

export async function GET(req: NextRequest) {
  let path: string;
  let append = "";
  switch (req.nextUrl.searchParams.get("module")) {
    case "surveys":
      path = `../../packages/surveys/dist/index.umd.js`;
      break;
    case "question-date":
      path = `../../packages/surveys/dist/question-date.umd.js`;
      break;
    case "js":
    case null:
      const format = ["umd", "iife"].includes(req.nextUrl.searchParams.get("format")!)
        ? req.nextUrl.searchParams.get("format")!
        : "umd";
      path = `../../packages/js/dist/index.${format}.js`;
      try {
        append = await handleInit(req);
      } catch (error) {
        return responses.badRequestResponse(error.message);
      }
      break;
    default:
      return responses.badRequestResponse(
        "unknown module requested. module must be of type 'js' (default), 'surveys' or 'question-date'"
      );
  }
  console.log("path", path);
  console.log("append", append);

  try {
    printAllDirectories().then(() => console.log("Done listing files."));
    const jsCode = await loadAndAppendCode(path, append);

    return new NextResponse(jsCode, {
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "public, s-maxage=600, max-age=1800, stale-while-revalidate=600, stale-if-error=600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.log("errir in serving file", error);

    return responses.internalServerErrorResponse("file not found");
  }
}

async function handleInit(req: NextRequest) {
  const environmentId = req.nextUrl.searchParams.get("environmentId");

  if (environmentId) {
    let environment: TEnvironment | null;

    try {
      environment = await getEnvironment(environmentId);
    } catch (error) {
      throw new Error(`error fetching environment: ${error.message}`);
    }

    if (!environment) {
      throw new Error("environment not found");
    }

    if (environment) {
      return `formbricks.init({environmentId: "${environmentId}", apiHost: "${WEBAPP_URL}"});`;
    }
  }
  return "";
}

// async function loadAndAppendCode(path: string, append: string): Promise<string> {
//   let jsCode = await fs.readFile(path, "utf-8");

//   return jsCode + append;
// }

async function loadAndAppendCode(relativePath: string, append: string): Promise<string> {
  // Resolve the absolute path based on the relative path
  const absolutePath = path.resolve(__dirname, relativePath);
  console.log("absolutePath", absolutePath);

  // Read the file using the absolute path
  let jsCode = await fs.readFile(absolutePath, "utf-8");
  console.log("jsCode", jsCode);

  return jsCode + append;
}
