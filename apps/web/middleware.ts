import rateLimit from "@/rate-limit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const signUpLimiter = rateLimit({ interval: 60 * 60 * 1000, allowedPerInterval: 5 }); // 60 minutes
const loginLimiter = rateLimit({ interval: 15 * 60 * 1000, allowedPerInterval: 5 }); // 15 minutes
const clientSideApiEndpointsLimiter = rateLimit({ interval: 60 * 60 * 1000, allowedPerInterval: 150 }); // 60 minutes

const loginRoute = (url: string) => url === "/api/auth/callback/credentials";
const signupRoute = (url: string) => url === "/api/v1/users";
const clientSideApiRoute = (url: string): boolean => {
  const regex = /^\/api\/v\d+\/client\//;
  return regex.test(url);
};

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
      if (loginRoute(request.nextUrl.pathname)) {
        await loginLimiter.check(ip);
      } else if (signupRoute(request.nextUrl.pathname)) {
        await signUpLimiter.check(ip);
      } else if (clientSideApiRoute(request.nextUrl.pathname)) {
        await clientSideApiEndpointsLimiter.check(ip);
      }
      return res;
    } catch (_e) {
      console.log("Rate Limiting IP: ", ip);

      return NextResponse.json({ error: "Too many requests, Please try after a while!" }, { status: 429 });
    }
  } else {
    return NextResponse.json({ error: "Too many requests, Please try after a while!" }, { status: 429 });
  }
}

export const config = {
  matcher: ["/api/auth/callback/credentials", "/api/v1/users", "/api/(.*)/client/:path*"],
};
