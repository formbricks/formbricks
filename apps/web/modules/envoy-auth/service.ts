import "server-only";
import { NextRequest } from "next/server";
import { gatewayRequestAuthorizers } from "@/modules/gateway-auth/lib/authorizers";
import { authorizeGatewayRequest } from "@/modules/gateway-auth/lib/request";
import { buildEnvoyAllowResponse, parseEnvoyRequestMetadata } from "./shared";

export const authorizeEnvoyRequest = async (request: NextRequest): Promise<Response> => {
  const requestMetadata = parseEnvoyRequestMetadata(request);
  if ("errorResponse" in requestMetadata) {
    return requestMetadata.errorResponse;
  }

  return await authorizeGatewayRequest({
    request,
    originalRequest: requestMetadata.originalRequest,
    authorizers: gatewayRequestAuthorizers,
    requestId: request.headers.get("x-request-id") ?? "unknown",
    buildAllowResponse: buildEnvoyAllowResponse,
    unsupportedRouteMessage: "Unsupported Envoy auth route",
  });
};
