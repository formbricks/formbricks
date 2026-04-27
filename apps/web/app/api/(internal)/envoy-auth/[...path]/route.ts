import { NextRequest } from "next/server";
import { authorizeEnvoyRequest } from "@/modules/envoy-auth/service";

const handler = async (request: NextRequest): Promise<Response> => {
  return await authorizeEnvoyRequest(request);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
