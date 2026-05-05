import { TV3Authentication } from "@/app/api/v3/lib/types";
import { createGatewayServiceToken } from "@/lib/jwt";
import { TGatewayAuthService } from "./service";

const getAuthenticatedUserId = (authentication: TV3Authentication): string | null => {
  return authentication && "user" in authentication ? authentication.user?.id : null;
};

export const createGatewayServiceTokenResponse = (
  authentication: TV3Authentication,
  service: TGatewayAuthService
): Response => {
  const userId = getAuthenticatedUserId(authentication);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { token, expiresAt } = createGatewayServiceToken(userId, service);
  return Response.json({ token, expiresAt });
};
