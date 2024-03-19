import { redisRateLimiter } from "@/app/api/internal/cache/client";
import { responses } from "@/app/lib/api/response";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const interval = parseInt(request.nextUrl.searchParams.get("interval") ?? "0");
  const allowedPerInterval = parseInt(request.nextUrl.searchParams.get("allowedPerInterval") ?? "0");
  if (!token) {
    return responses.notAuthenticatedResponse();
  }

  try {
    const rateLimiter = redisRateLimiter({ interval, allowedPerInterval });
    await rateLimiter(token);

    return responses.successResponse({ rateLimitExceeded: false }, true);
  } catch (e) {
    return responses.successResponse({ rateLimitExceeded: true }, true);
  }
}
