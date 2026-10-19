import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@formbricks/logger";
import { isPublicDomainConfigured, isRequestFromPublicDomain } from "@/app/middleware/domain-utils";
import { isAuthProtectedRoute, isRouteAllowedForDomain } from "@/app/middleware/endpoint-validator";
import { WEBAPP_URL } from "@/lib/constants";
import { FORMBRICKS_WORKSPACE_ID_COOKIE } from "@/lib/localStorage";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import { getProxySession } from "@/modules/auth/lib/proxy-session";

const handleAuth = async (request: NextRequest): Promise<Response | null> => {
  const session = await getProxySession(request);

  if (isAuthProtectedRoute(request.nextUrl.pathname) && !session) {
    const loginUrl = `${WEBAPP_URL}/auth/login?callbackUrl=${encodeURIComponent(WEBAPP_URL + request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(loginUrl);
  }

  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, WEBAPP_URL);

  if (callbackUrl && !validatedCallbackUrl) {
    return NextResponse.json({ error: "Invalid callback URL" }, { status: 400 });
  }

  if (session && validatedCallbackUrl) {
    return NextResponse.redirect(validatedCallbackUrl);
  }

  return null;
};

/**
 * Handle domain-aware routing based on PUBLIC_URL and WEBAPP_URL
 */
const handleDomainAwareRouting = (request: NextRequest): Response | null => {
  try {
    const publicDomainConfigured = isPublicDomainConfigured();

    // When PUBLIC_URL is not configured, admin domain allows all routes (backward compatibility)
    if (!publicDomainConfigured) return null;

    const isPublicDomain = isRequestFromPublicDomain(request);

    const pathname = request.nextUrl.pathname;

    // Check if the route is allowed for the current domain
    const isAllowed = isRouteAllowedForDomain(pathname, isPublicDomain);

    if (!isAllowed) {
      return new NextResponse(null, { status: 404 });
    }

    return null; // Allow the request to continue
  } catch (error) {
    logger.error(error, "Error handling domain-aware routing");
    return new NextResponse(null, { status: 404 });
  }
};

/**
 * Largest body the PostHog `/ingest` rewrite will forward: the size Next cut these bodies off at before
 * `patches/next@16.2.11.patch` stopped it cloning them (ENG-3972), so nothing that passed before is refused.
 */
export const INGEST_REQUEST_BODY_LIMIT_BYTES = 16 * 1024 * 1024;

/**
 * The `/ingest` rewrite pipes the request body straight to PostHog, so without a bound an anonymous caller
 * could stream any amount through this server. Proxy never reads bodies, so the bound comes from the framing:
 * a declared length over the limit is refused, and so is a body of undeclared length (chunked), which no
 * browser sends for the Blob and string bodies posthog-js posts. Node stops reading at the declared length,
 * so an accepted body cannot outgrow it.
 */
const handleIngestBodyLimit = (request: NextRequest): NextResponse | null => {
  // Next matches rewrites without regard to case (`caseSensitiveRoutes` is off), so `/INGEST/e` reaches PostHog too.
  // Proxy's own matcher is case-sensitive, though, so under a `BASE_PATH` a request spelling the base path in
  // another case (`/FB/ingest/e` for `/fb`) skips Proxy and this bound while the rewrite still matches. Only
  // builds with `POSTHOG_KEY` have the rewrite, and none of those set `BASE_PATH`.
  const pathname = request.nextUrl.pathname.toLowerCase();
  if (pathname !== "/ingest" && !pathname.startsWith("/ingest/")) return null;

  if (request.headers.has("transfer-encoding")) return new NextResponse(null, { status: 411 });

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    // A length that does not parse is refused too; Node rejects one first, but nothing here relies on it.
    const declared = Number(contentLength);
    if (Number.isNaN(declared) || declared > INGEST_REQUEST_BODY_LIMIT_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
  }

  return null;
};

/**
 * Never read the request body here. `patches/next@16.2.11.patch` stops Next handing the proxy one
 * (ENG-3972), so a read would find nothing, while the route still gets the untouched stream.
 * `lib/next-proxy-body.test.ts` enforces both halves.
 */
export const proxy = async (originalRequest: NextRequest) => {
  // Handle domain-aware routing first
  const domainResponse = handleDomainAwareRouting(originalRequest);
  if (domainResponse) return domainResponse;

  const ingestResponse = handleIngestBodyLimit(originalRequest);
  if (ingestResponse) return ingestResponse;

  // Create a new Request object to override headers and add a unique request ID header
  const request = new NextRequest(originalRequest, {
    headers: new Headers(originalRequest.headers),
  });

  request.headers.set("x-request-id", uuidv4());
  request.headers.set("x-start-time", Date.now().toString());

  // Create a new NextResponse object to forward the new request with headers
  const nextResponseWithCustomHeader = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Handle authentication
  const authResponse = await handleAuth(request);
  if (authResponse) return authResponse;

  // Remember the active workspace so the workspace-agnostic org-settings shell can resolve it
  // server-side (localStorage is browser-only). Mirrors the /workspaces/[workspaceId] path segment.
  // Only set the cookie when the value actually changes: a Set-Cookie on a server-action POST makes
  // Next.js treat the action as revalidated, forcing a router refresh after every action — on pages
  // that call an action on mount this becomes an infinite POST/refresh loop.
  const workspaceMatch = /^\/workspaces\/([^/]+)/.exec(request.nextUrl.pathname);
  if (
    workspaceMatch?.[1] &&
    request.cookies.get(FORMBRICKS_WORKSPACE_ID_COOKIE)?.value !== workspaceMatch[1]
  ) {
    nextResponseWithCustomHeader.cookies.set(FORMBRICKS_WORKSPACE_ID_COOKIE, workspaceMatch[1], {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return nextResponseWithCustomHeader;
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|js|css|images|fonts|icons|public|animated-bgs).*)",
  ],
};
