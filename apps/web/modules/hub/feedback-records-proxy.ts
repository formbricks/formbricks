import "server-only";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { HUB_API_KEY, HUB_API_URL, IS_PRODUCTION } from "@/lib/constants";
import { authorizeGatewayRequest } from "@/modules/gateway-auth/lib/request";
import { feedbackRecordsGatewayAuthorizer } from "@/modules/hub/feedback-records-gateway";
import { getFeedbackRecordsHubPathname } from "@/modules/hub/feedback-records-routing";
import { getHubErrorHint } from "@/modules/hub/utils";

const FORWARDED_CREDENTIAL_HEADERS = ["authorization", "cookie", "x-api-key"] as const;
const HOP_BY_HOP_REQUEST_HEADERS = [
  "connection",
  "content-length",
  // The 100-continue exchange belongs to the client's hop, which Node has already answered, and
  // undici refuses the header outright, so forwarding it would fail the Hub call (curl sends it for
  // bodies above 1 MiB).
  "expect",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
] as const;
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

const buildHubRequestUrl = (requestUrl: URL): URL | null => {
  const hubPathname = getFeedbackRecordsHubPathname(requestUrl.pathname);
  if (!hubPathname) {
    return null;
  }

  const hubUrl = new URL(HUB_API_URL);
  hubUrl.pathname = hubPathname;
  hubUrl.search = requestUrl.search;
  hubUrl.hash = "";

  return hubUrl;
};

// Every field is copied explicitly rather than passing `request` as the init: the source is Next's
// proxied route request (see proxyFeedbackRecordsRequest), and an explicit init forwards only what the
// Hub hop needs. Paired with `fetch(url, init)`, it also keeps Next's patched fetch from rebuilding a
// Request input around the body stream.
const buildHubRequestInit = (request: Request, signal: AbortSignal): RequestInit => {
  const headers = new Headers(request.headers);
  const connectionHeaders = (request.headers.get("connection") ?? "")
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter((header) => HEADER_NAME_PATTERN.test(header));
  const headersToRemove = new Set([
    ...FORWARDED_CREDENTIAL_HEADERS,
    ...HOP_BY_HOP_REQUEST_HEADERS,
    ...connectionHeaders,
  ]);

  for (const header of headersToRemove) {
    headers.delete(header);
  }

  headers.set("authorization", `Bearer ${HUB_API_KEY}`);

  return {
    method: request.method,
    headers,
    // A client disconnect keeps aborting the Hub call.
    signal,
    // Envoy never follows an upstream redirect; neither does this stand-in, so a Hub 3xx reaches the
    // caller instead of being chased server-side with the service credential attached.
    redirect: "manual",
    // This is a pass-through for live records and writes: a cached response would keep serving
    // updated or deleted records, and `force-cache` would let a POST be answered without reaching
    // the Hub.
    cache: "no-store",
    // `duplex` is absent from TypeScript's RequestInit; cast only that property so the rest keeps its
    // checking. undici requires it for a stream body.
    ...(request.body ? { body: request.body, ...({ duplex: "half" } as RequestInit) } : {}),
  };
};

const buildAllowResponse = (): Response => new Response(null, { status: 200 });

export const proxyFeedbackRecordsRequest = async (request: NextRequest): Promise<Response> => {
  if (IS_PRODUCTION) {
    return new Response(null, { status: 404 });
  }

  const originalUrl = new URL(request.url);
  const requestId = request.headers.get("x-request-id") ?? "unknown";
  const hubUrl = buildHubRequestUrl(originalUrl);
  if (!hubUrl) {
    return new Response("Unsupported FeedbackRecords proxy route", { status: 400 });
  }

  // `request` is not a plain NextRequest: Next's app-route runtime wraps every handler's request in a
  // Proxy, and `clone()` returns another one. Fetch objects keep their state in private fields a Proxy
  // cannot carry, so neither may become a Request constructor's `input` (nodejs/undici#4290).
  // Reading through the Proxy is fine.
  //
  // The authorizer gets the request itself, as the production ext_authz route does: it needs the real
  // cookies for session auth and may consume the body (POST routes read `tenant_id` from it), so a
  // request with a body is forwarded from a clone taken before authorization reads anything.
  const hubBoundRequest = request.body ? request.clone() : request;

  const authorizationResponse = await authorizeGatewayRequest({
    request,
    originalRequest: {
      method: request.method.toUpperCase(),
      url: originalUrl,
    },
    authorizers: [feedbackRecordsGatewayAuthorizer],
    requestId,
    buildAllowResponse,
    unsupportedRouteMessage: "Unsupported FeedbackRecords proxy route",
  });

  if (!authorizationResponse.ok) {
    return authorizationResponse;
  }

  try {
    // The signal is the incoming request's own, not the clone's: undici makes a clone's signal follow
    // the original only through a WeakRef, so a garbage collection mid-flight silently stops a client
    // disconnect from aborting the Hub call (nodejs/undici#4068). Next keeps `request` alive for the
    // whole handler, and with it the link to the connection.
    return await fetch(hubUrl, buildHubRequestInit(hubBoundRequest, request.signal));
  } catch (err) {
    // The caller hung up and the abort cancelled the Hub call: nothing failed upstream and nobody is
    // left to answer, so this is not logged as a proxy failure. 499 is the conventional "client closed
    // request" status.
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    // Deliberately still does not log `err`: a fetch failure embeds the target URL in its message,
    // which can carry credentials or query parameters, and keeping it out of the logs is the point
    // of this payload being hand-built. The hint is derived from the error's errno alone and is a
    // constant string, so it names Hub as the likely cause without reintroducing that detail.
    logger.error(
      {
        requestId,
        method: request.method,
        pathname: originalUrl.pathname,
        hint: getHubErrorHint(err),
      },
      "Feedback records local proxy request failed"
    );

    // Body stays a constant: the response reaches the browser, so it must not carry the cause.
    return new Response("Bad Gateway", { status: 502 });
  }
};
