import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { responses } from "@/lib/api/response";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return responses.unauthorizedResponse();
  }

  const data = await request.json();

  const { json, fields, fileName } = data;

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(json, { header: fields });
  xlsx.utils.book_append_sheet(wb, ws, "Sheet1");

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  const binaryString = String.fromCharCode.apply(null, buffer);
  const base64String = btoa(binaryString);

  const headers = new Headers();
  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  headers.set("Content-Disposition", `attachment; filename=${fileName ?? "converted"}.xlsx`);

  return NextResponse.json(
    {
      fileResponse: base64String,
    },
    {
      headers,
    }
  );
}
