import "server-only";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";

export const CUBE_API_TOKEN_TTL_SECONDS = 5 * 60;
export const CUBE_QUERY_SCOPE = "xm:cube:query";
export const DEFAULT_CUBE_JWT_AUDIENCE = "formbricks-cube";
export const DEFAULT_CUBE_JWT_ISSUER = "formbricks-web";

export type TCubeQuerySource =
  | "charts.executeQueryAction"
  | "charts.generateAIChartAction"
  | "charts.getDimensionValuesAction"
  | "dashboards.widget";

export type TCubeTenantScope = {
  feedbackDirectoryId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
  source: TCubeQuerySource;
};

export type TCubeApiToken = {
  token: string;
  requestId: string;
};

export const normalizeCubeApiUrl = (baseUrl: string): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  if (normalizedBaseUrl.endsWith("/cubejs-api/v1")) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/cubejs-api/v1`;
};

export const getCubeApiCredentials = () => ({
  apiUrl: normalizeCubeApiUrl(env.CUBEJS_API_URL),
  apiSecret: env.CUBEJS_API_SECRET,
  audience: env.CUBEJS_JWT_AUDIENCE ?? DEFAULT_CUBE_JWT_AUDIENCE,
  issuer: env.CUBEJS_JWT_ISSUER ?? DEFAULT_CUBE_JWT_ISSUER,
});

export const createCubeApiToken = (
  apiSecret: string,
  tenantScope: TCubeTenantScope,
  {
    audience = DEFAULT_CUBE_JWT_AUDIENCE,
    issuer = DEFAULT_CUBE_JWT_ISSUER,
  }: {
    audience?: string;
    issuer?: string;
  } = {}
): TCubeApiToken => {
  const requestId = randomUUID();

  return {
    token: jwt.sign(
      {
        tenantId: tenantScope.feedbackDirectoryId,
        feedbackDirectoryId: tenantScope.feedbackDirectoryId,
        workspaceId: tenantScope.workspaceId,
        organizationId: tenantScope.organizationId,
        userId: tenantScope.userId,
        scope: CUBE_QUERY_SCOPE,
        source: tenantScope.source,
      },
      apiSecret,
      {
        algorithm: "HS256",
        audience,
        expiresIn: CUBE_API_TOKEN_TTL_SECONDS,
        issuer,
        jwtid: requestId,
      }
    ),
    requestId,
  };
};

export const getCubeApiConfig = (tenantScope: TCubeTenantScope) => {
  const { apiSecret, apiUrl, audience, issuer } = getCubeApiCredentials();

  return {
    apiUrl,
    audience,
    issuer,
    ...createCubeApiToken(apiSecret, tenantScope, { audience, issuer }),
  };
};
