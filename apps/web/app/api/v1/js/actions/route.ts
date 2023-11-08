import { responses } from "@/app/lib/api/response";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}
