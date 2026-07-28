import { NextRequest } from "next/server";
import { proxyFeedbackRecordsRequest } from "@/modules/hub/feedback-records-proxy";

const handler = async (request: NextRequest): Promise<Response> => {
  return await proxyFeedbackRecordsRequest(request);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
