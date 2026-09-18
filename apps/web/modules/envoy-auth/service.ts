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

  // The authorizer answers an outcome rather than a response, because its other caller — the app's own
  // `/v1/feedback-records` passthrough — forwards the request itself and needs the principal it was
  // allowed as. ext_authz has no use for the principal: Envoy reads an allow from the status line, so
  // the allow is rendered here and the deny is passed through as built.
  const outcome = await authorizeGatewayRequest({
    request,
    originalRequest: requestMetadata.originalRequest,
    authorizers: gatewayRequestAuthorizers,
    requestId: request.headers.get("x-request-id") ?? "unknown",
    unsupportedRouteMessage: "Unsupported Envoy auth route",
  });

  return outcome.status === "allow" ? buildEnvoyAllowResponse() : outcome.response;
};
