import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@formbricks/logger";
import { isPublicDomainConfigured, isRequestFromPublicDomain } from "@/app/middleware/domain-utils";
import { isAuthProtectedRoute, isRouteAllowedForDomain } from "@/app/middleware/endpoint-validator";
import { TRUSTED_PROXY_HOP_COUNT, WEBAPP_URL } from "@/lib/constants";
import { FORMBRICKS_ORGANIZATION_ID_COOKIE, FORMBRICKS_WORKSPACE_ID_COOKIE } from "@/lib/localStorage";
import { FORMBRICKS_CLIENT_IP_HEADER, resolveClientIp } from "@/lib/utils/client-ip";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import { getProxySession } from "@/modules/auth/lib/proxy-session";

const handleAuth = async (request: NextRequest): Promise<NextResponse | null> => {
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
const handleDomainAwareRouting = (request: NextRequest): NextResponse | null => {
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
 * `patches/next@16.3.8.patch` stopped it cloning them (ENG-3972), so nothing that passed before is refused.
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
 * Request headers Next.js sets only on prefetches (`next/dist/client/components/app-router-headers`).
 * A prefetch is speculative — the router issues one for every link it has rendered, whether or not
 * the user ever opens it — so it must never be read as "the user is here now".
 */
const NEXT_PREFETCH_HEADERS = [
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "next-instant-navigation-testing-prefetch",
] as const;

const isPrefetchRequest = (request: NextRequest): boolean =>
  NEXT_PREFETCH_HEADERS.some((header) => request.headers.has(header));

/**
 * Never read the request body here. `patches/next@16.3.8.patch` stops Next handing the proxy one
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

  const clientIp = resolveClientIp(request.headers, TRUSTED_PROXY_HOP_COUNT);
  if (clientIp) {
    request.headers.set(FORMBRICKS_CLIENT_IP_HEADER, clientIp);
  } else {
    // A caller may send this private header directly. Removing it on failure is what makes Proxy the
    // trust boundary; downstream code must never see an identity Proxy did not establish itself.
    request.headers.delete(FORMBRICKS_CLIENT_IP_HEADER);
  }

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

  // Remember the active workspace (and organization) so the workspace-agnostic settings shell can
  // resolve it server-side (localStorage is browser-only). Mirrors the /workspaces/[workspaceId] and
  // /organizations/[organizationId] path segments — see `rememberActiveContext`.
  // Only set a cookie when the value actually changes: a Set-Cookie on a server-action POST makes
  // Next.js treat the action as revalidated, forcing a router refresh after every action — on pages
  // that call an action on mount this becomes an infinite POST/refresh loop.
  //
  // Prefetches are excluded because they are not visits. The router re-prefetches the links of a
  // tree it rendered earlier, so after deleting a workspace it still prefetches that workspace's
  // now-stale links — and letting one write this cookie overwrote the surviving workspace the
  // delete action had just stored, pointing it at a workspace that no longer exists. The
  // org-settings shell then cannot trust the cookie and falls back to `organizations[0]`, dropping
  // a member of several organizations into an unrelated one.
  if (!isPrefetchRequest(request)) {
    rememberActiveContext(request, nextResponseWithCustomHeader);
  }

  return nextResponseWithCustomHeader;
};

const ACTIVE_CONTEXT_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 365,
} as const;

/**
 * Records where the user is so account settings (which carry no organization in the URL) render the
 * organization the user is in. A workspace visit stores the workspace and drops the organization
 * cookie, because the workspace now names the organization. An organization-scoped visit stores the
 * organization — this is the only signal for an organization with no workspace yet, whose landing
 * page would otherwise leave the workspace cookie pointing into the previous organization.
 *
 * Each cookie is written only when its value changes (see the server-action note above).
 */
const rememberActiveContext = (request: NextRequest, response: NextResponse): void => {
  const { pathname } = request.nextUrl;
  const workspaceId = /^\/workspaces\/([^/]+)/.exec(pathname)?.[1];
  const organizationId = /^\/organizations\/([^/]+)/.exec(pathname)?.[1];

  if (workspaceId) {
    if (request.cookies.get(FORMBRICKS_WORKSPACE_ID_COOKIE)?.value !== workspaceId) {
      response.cookies.set(FORMBRICKS_WORKSPACE_ID_COOKIE, workspaceId, ACTIVE_CONTEXT_COOKIE_OPTIONS);
    }
    if (request.cookies.has(FORMBRICKS_ORGANIZATION_ID_COOKIE)) {
      response.cookies.delete(FORMBRICKS_ORGANIZATION_ID_COOKIE);
    }
    return;
  }

  if (organizationId && request.cookies.get(FORMBRICKS_ORGANIZATION_ID_COOKIE)?.value !== organizationId) {
    response.cookies.set(FORMBRICKS_ORGANIZATION_ID_COOKIE, organizationId, ACTIVE_CONTEXT_COOKIE_OPTIONS);
  }
};

export const config = {
  matcher: [
    // Keep asset exclusions segment-bound: every dynamic route must traverse Proxy so callers cannot
    // bypass the private client-IP header overwrite by choosing an asset-like route prefix.
    //
    // The `\\.` escapes stay, and S7780's `String.raw` fix must NOT be applied here: Next.js reads this
    // matcher by statically parsing the file, and its extractor
    // (`next/dist/build/analysis/extract-const-value.js`, 16.2.11) understands string literals,
    // template literals, arrays and objects — but not a `TaggedTemplateExpression`. Verified against
    // Next's own SWC parser: `String.raw` yields `Unsupported node type "TaggedTemplateExpression" at
    // "config.matcher[0]"`, which throws in dev and, in a production build, only logs an error and
    // leaves `config` undefined — so `parseMiddlewareConfig` receives nothing and the matcher is
    // silently DROPPED, running Proxy on every static asset and voiding the exclusions above. A plain
    // template literal parses, but needs the same `\\.` escapes, so it does not satisfy the rule either.
    "/((?!_next/(?:static|image)(?:/|$)|(?:favicon\\.ico|sitemap\\.xml|robots\\.txt)$|(?:js|css|images|fonts|icons|public|animated-bgs)(?:/|$)).*)", // NOSONAR(typescript:S7780) -- String.raw breaks Next.js's static matcher extraction; see above
  ],
};
