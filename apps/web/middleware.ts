import rateLimit from "@/app/(auth)/auth/rate-limit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const signUpLimiter = rateLimit({ interval: 60 * 60 * 1000 }); // 60 minutes
const loginLimiter = rateLimit({ interval: 15 * 60 * 1000 }); // 15 minutes

export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  let ip = request.ip ?? request.headers.get("x-real-ip");
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? null;
  }

  if (ip) {
    try {
      if (request.nextUrl.pathname === "/api/auth/callback/credentials") {
        await loginLimiter.check(ip);
      } else if (request.nextUrl.pathname === "/api/v1/users") {
        await signUpLimiter.check(ip);
      }
      return res;
    } catch (_e) {
      console.log("Rate Limiting IP: ", ip);

      return NextResponse.json({ error: "Too many requests, Please try after a while!" }, { status: 429 });
    }
  }
  return res;
}

export const config = {
  matcher: ["/api/auth/callback/credentials", "/api/v1/users"],
};
