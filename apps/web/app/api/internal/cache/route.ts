import { redisRateLimiter } from "@/app/api/internal/cache/client";
import { responses } from "@/app/lib/api/response";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const interval = parseInt(request.nextUrl.searchParams.get("interval") ?? "0");
  const allowedPerInterval = parseInt(request.nextUrl.searchParams.get("allowedPerInterval") ?? "0");

  console.log("came in /internal/cache/", token, interval, allowedPerInterval);

  if (!token) {
    return responses.notAuthenticatedResponse();
  }

  try {
    console.log("trying to init redis rate limiter");

    const rateLimiter = redisRateLimiter({ interval, allowedPerInterval });

    console.log("init redis rate limiter done now calling it");

    await rateLimiter(token);

    console.log("redis rate limiter done");

    return responses.successResponse({ rateLimitExceeded: false }, true);
  } catch (e) {
    console.log("Rate Limiting IP: ", token, " Error: ", e.message);
    return responses.successResponse({ rateLimitExceeded: true }, true);
  }
}
