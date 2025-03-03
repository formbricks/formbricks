import { responses } from "@/app/lib/api/response";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import * as xlsx from "xlsx";

export const POST = async (request: NextRequest) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    return responses.unauthorizedResponse();
  }

  const data = await request.json();

  const { json, fields, fileName } = data;

  const fallbackFileName = fileName.replace(/[^A-Za-z0-9_.-]/g, "_");
  const encodedFileName = encodeURIComponent(fileName)
    .replace(/['()]/g, (match) => "%" + match.charCodeAt(0).toString(16))
    .replace(/\*/g, "%2A");

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(json, { header: fields });
  xlsx.utils.book_append_sheet(wb, ws, "Sheet1");

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const base64String = buffer.toString("base64");

  const headers = new Headers();

  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  headers.set(
    "Content-Disposition",
    `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`
  );

  return Response.json(
    {
      fileResponse: base64String,
    },
    {
      headers,
    }
  );
};
