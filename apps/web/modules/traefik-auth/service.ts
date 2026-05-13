import "server-only";
import { NextRequest } from "next/server";
import { gatewayRequestAuthorizers } from "@/modules/gateway-auth/lib/authorizers";
import { authorizeGatewayRequest } from "@/modules/gateway-auth/lib/request";
import { buildTraefikAllowResponse, parseTraefikRequestMetadata } from "./shared";

export const authorizeTraefikRequest = async (request: NextRequest): Promise<Response> => {
  const requestMetadata = parseTraefikRequestMetadata(request);
  if ("errorResponse" in requestMetadata) {
    return requestMetadata.errorResponse;
  }

  return await authorizeGatewayRequest({
    request,
    originalRequest: requestMetadata.originalRequest,
    authorizers: gatewayRequestAuthorizers,
    requestId: request.headers.get("x-request-id") ?? request.headers.get("x-forwarded-for") ?? "unknown",
    buildAllowResponse: buildTraefikAllowResponse,
    unsupportedRouteMessage: "Unsupported Traefik auth route",
  });
};
