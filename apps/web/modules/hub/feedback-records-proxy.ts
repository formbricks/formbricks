import "server-only";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { HUB_API_KEY, HUB_API_URL, IS_PRODUCTION } from "@/lib/constants";
import { authorizeGatewayRequest } from "@/modules/gateway-auth/lib/request";
import { feedbackRecordsGatewayAuthorizer } from "@/modules/hub/feedback-records-gateway";
import { getFeedbackRecordsHubPathname } from "@/modules/hub/feedback-records-routing";

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

  for (const header of FORWARDED_CREDENTIAL_HEADERS) {
    hubRequest.headers.delete(header);
  }
  for (const header of HOP_BY_HOP_REQUEST_HEADERS) {
    hubRequest.headers.delete(header);
  }

  hubRequest.headers.set("authorization", `Bearer ${HUB_API_KEY}`);

  return hubRequest;
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
  } catch {
    logger.error(
      {
        requestId,
        method: request.method,
        pathname: originalUrl.pathname,
      },
      "Feedback records local proxy request failed"
    );

    return new Response("Bad Gateway", { status: 502 });
  }
};
