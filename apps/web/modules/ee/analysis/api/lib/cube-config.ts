import "server-only";
import jwt from "jsonwebtoken";
import { ConfigurationError } from "@formbricks/types/errors";
import { env } from "@/lib/env";

export const CUBE_CONFIGURATION_ERROR_MESSAGE =
  "Cube is not configured on this instance. Set CUBEJS_API_URL and CUBEJS_API_SECRET.";
export const CUBE_API_TOKEN_TTL_SECONDS = 60 * 60;

export const normalizeCubeApiUrl = (baseUrl: string): string => {
  if (baseUrl.includes("/cubejs-api/v1")) {
    return baseUrl;
  }

  return `${baseUrl.replace(/\/$/, "")}/cubejs-api/v1`;
};

export const getCubeApiCredentials = () => {
  if (!env.CUBEJS_API_URL || !env.CUBEJS_API_SECRET) {
    throw new ConfigurationError(CUBE_CONFIGURATION_ERROR_MESSAGE);
  }

  return {
    apiUrl: normalizeCubeApiUrl(env.CUBEJS_API_URL),
    apiSecret: env.CUBEJS_API_SECRET,
  };
};

export const createCubeApiToken = (apiSecret: string) => {
  const tokenIssuedAtMs = Date.now();

  return {
    token: jwt.sign({}, apiSecret, {
      algorithm: "HS256",
      expiresIn: CUBE_API_TOKEN_TTL_SECONDS,
    }),
    tokenExpiresAtMs: tokenIssuedAtMs + CUBE_API_TOKEN_TTL_SECONDS * 1000,
  };
};

export const getCubeApiConfig = () => {
  const { apiSecret, apiUrl } = getCubeApiCredentials();

  return {
    apiUrl,
    apiSecret,
    ...createCubeApiToken(apiSecret),
  };
};
