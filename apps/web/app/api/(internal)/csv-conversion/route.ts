import { responses } from "@/app/lib/api/response";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { AsyncParser } from "@json2csv/node";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";

export const POST = async (request: NextRequest) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    return responses.unauthorizedResponse();
  }

  const data = await request.json();
  let csv: string = "";

  const { json, fields, fileName } = data;

  const fallbackFileName = fileName.replace(/[^A-Za-z0-9_.-]/g, "_");
  const encodedFileName = encodeURIComponent(fileName)
    .replace(/['()]/g, (match) => "%" + match.charCodeAt(0).toString(16))
    .replace(/\*/g, "%2A");

  const parser = new AsyncParser({
    fields,
  });

  try {
    csv = await parser.parse(json).promise();
  } catch (err) {
    console.error(err);
    throw new Error("Failed to convert to CSV");
  }

  const headers = new Headers();
  headers.set("Content-Type", "text/csv;charset=utf-8;");
  headers.set(
    "Content-Disposition",
    `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`
  );

  return Response.json(
    {
      fileResponse: csv,
    },
    {
      headers,
    }
  );
};
