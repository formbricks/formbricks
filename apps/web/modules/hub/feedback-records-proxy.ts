import "server-only";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { HUB_API_KEY, HUB_API_URL } from "@/lib/constants";
import { authorizeGatewayRequest } from "@/modules/gateway-auth/lib/request";
import { feedbackRecordsGatewayAuthorizer } from "@/modules/hub/feedback-records-gateway";
import { getFeedbackRecordsHubPathname } from "@/modules/hub/feedback-records-routing";
import { getHubErrorHint } from "@/modules/hub/utils";

const FORWARDED_CREDENTIAL_HEADERS = ["authorization", "cookie", "x-api-key"] as const;
const HOP_BY_HOP_REQUEST_HEADERS = [
  "connection",
  "content-length",
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

/**
 * A second readable view of the request, for the authorizer to consume the body from.
 */
const authorizationRequest = (request: NextRequest): NextRequest =>
  new NextRequest(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.clone().body,
    // Required by undici whenever a streaming body is supplied.
    duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1]);

const buildHubRequest = (request: NextRequest, hubUrl: URL): Request => {
  const hubRequest = new Request(hubUrl, request);
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
    hubRequest.headers.delete(header);
  }

  hubRequest.headers.set("authorization", `Bearer ${HUB_API_KEY}`);

  return hubRequest;
};

/**
 * Forwards a feedback-record request to the store, having authorized it against Formbricks first.
 *
 * This used to refuse in production (`IS_PRODUCTION` → 404) because the gateway served these paths
 * there and a second data path would have been a liability. ENG-3117 retires those gateway routes, so
 * this is now the only way `/v1/feedback-records` is served, in every environment. The route exists
 * to keep the feedback store's own path shape working for callers pointing `hub-typescript` at a
 * Formbricks origin; everything else moved to `/api/v3/feedback-records`, which the app serves
 * natively and which is what new integrations should use.
 *
 * Deliberately still a passthrough. Translating between the two contracts here — the store's
 * `tenant_id` and snake_case against v3's `workspaceId`/`datasetId` and camelCase — would mean
 * writing the inverse of the v3 serializers plus a response direction that does not exist, to arrive
 * at bytes the store already returns.
 *
 * Rate-limited on `rateLimitConfigs.api.v3` — the same config, namespace and identifier every v3
 * route gets from the shared wrapper. This path cannot use the wrapper itself (it forwards a request
 * rather than handling one); the limit is applied by `authorizeGatewayRequest`, between
 * authentication and authorization, so the two forward-auth callers are covered by the same counter
 * rather than by nothing.
 */
export const proxyFeedbackRecordsRequest = async (request: NextRequest): Promise<Response> => {
  const originalUrl = new URL(request.url);
  const requestId = request.headers.get("x-request-id") ?? "unknown";
  const hubUrl = buildHubRequestUrl(originalUrl);
  if (!hubUrl) {
    return new Response("Unsupported FeedbackRecords proxy route", { status: 400 });
  }

  const authorization = await authorizeGatewayRequest({
    // Built from the URL and an init rather than by wrapping `request.clone()`. Wrapping a cloned
    // NextRequest throws `Cannot read private member #state from an object whose class did not declare
    // it` on Node >24: the clone's class does not declare undici's private field that the constructor
    // reaches for. It only reproduces through the running server, because the NextRequest the server
    // runtime passes a route handler is not the one importable in a test.
    //
    // The clone itself is load-bearing and stays: the authorizer reads the body to find `tenant_id`,
    // and the original has to survive unread so it can be forwarded to the store.
    request: authorizationRequest(request),
    originalRequest: {
      method: request.method.toUpperCase(),
      url: originalUrl,
    },
    authorizers: [feedbackRecordsGatewayAuthorizer],
    requestId,
    unsupportedRouteMessage: "Unsupported FeedbackRecords proxy route",
  });

  if (authorization.status === "deny") {
    return authorization.response;
  }

  try {
    return await fetch(buildHubRequest(request, hubUrl), { cache: "no-store" });
  } catch (err) {
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
