import { NextRequest, NextResponse } from "next/server";
import { Parser } from "@json2csv/plainjs";

export async function POST(request: NextRequest) {
  const data = await request.json();

  const { json, fields } = data;

  const parser = new Parser({
    fields,
  });

  const csv = parser.parse(json);

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = URL.createObjectURL(blob);

  const headers = new Headers();
  headers.set("Content-Type", "text/csv;charset=utf-8;");
  headers.set("Content-Disposition", "attachment; filename=survey_responses.csv");

  return NextResponse.json(
    {
      downloadUrl,
    },
    {
      headers,
    }
  );
}
