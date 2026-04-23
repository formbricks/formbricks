import { NextRequest } from "next/server";
import { authorizeFeedbackRecordsGatewayRequest } from "@/modules/hub/feedback-records-gateway";

const handler = async (request: NextRequest): Promise<Response> => {
  return await authorizeFeedbackRecordsGatewayRequest(request);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
