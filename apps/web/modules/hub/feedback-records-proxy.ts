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

const buildAllowResponse = (): Response => new Response(null, { status: 200 });

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
 * Not rate-limited, unlike the v3 routes. That is the behaviour this path has always had, and adding
 * a limit to a live path is a change of its own: the v3 wrapper's 100/minute is the number to settle
 * first, on an API advertised for bulk review imports (ENG-3117 S10).
 */
export const proxyFeedbackRecordsRequest = async (request: NextRequest): Promise<Response> => {
  const originalUrl = new URL(request.url);
  const requestId = request.headers.get("x-request-id") ?? "unknown";
  const hubUrl = buildHubRequestUrl(originalUrl);
  if (!hubUrl) {
    return new Response("Unsupported FeedbackRecords proxy route", { status: 400 });
  }

  const authorizationResponse = await authorizeGatewayRequest({
    request: new NextRequest(request.clone()),
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
