import "server-only";
import { NextRequest } from "next/server";
import { feedbackRecordsEnvoyAuthorizer } from "@/modules/hub/feedback-records-gateway";
import {
  TEnvoyRequestAuthorizer,
  authenticateEnvoyRequest,
  buildStatusResponse,
  parseEnvoyRequestMetadata,
} from "./shared";

const envoyAuthorizers: TEnvoyRequestAuthorizer[] = [feedbackRecordsEnvoyAuthorizer];

export const authorizeEnvoyRequest = async (request: NextRequest): Promise<Response> => {
  const requestMetadata = parseEnvoyRequestMetadata(request);
  if ("errorResponse" in requestMetadata) {
    return requestMetadata.errorResponse;
  }

  const authorizer = envoyAuthorizers.find((candidate) => candidate.matches(requestMetadata.originalRequest));
  if (!authorizer) {
    return buildStatusResponse(400, "Unsupported Envoy auth route");
  }

  const authenticationResult = await authenticateEnvoyRequest(request, authorizer.gatewayToken);
  if (authenticationResult.status === "missing" || authenticationResult.status === "invalid") {
    return buildStatusResponse(401, "Unauthorized");
  }

  return await authorizer.authorize({
    request,
    originalRequest: requestMetadata.originalRequest,
    principal: authenticationResult.principal,
    requestId: request.headers.get("x-request-id") ?? "unknown",
  });
};
