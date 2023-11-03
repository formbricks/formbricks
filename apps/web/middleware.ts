import rateLimit from "@/rate-limit";
import { CLIENT_SIDE_API_RATE_LIMIT, LOGIN_RATE_LIMIT, SIGNUP_RATE_LIMIT } from "@formbricks/lib/constants";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const signUpLimiter = rateLimit({
  interval: SIGNUP_RATE_LIMIT.interval,
  allowedPerInterval: SIGNUP_RATE_LIMIT.allowedPerInterval,
});
const loginLimiter = rateLimit({
  interval: LOGIN_RATE_LIMIT.interval,
  allowedPerInterval: LOGIN_RATE_LIMIT.allowedPerInterval,
});
const clientSideApiEndpointsLimiter = rateLimit({
  interval: CLIENT_SIDE_API_RATE_LIMIT.interval,
  allowedPerInterval: CLIENT_SIDE_API_RATE_LIMIT.allowedPerInterval,
});

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
