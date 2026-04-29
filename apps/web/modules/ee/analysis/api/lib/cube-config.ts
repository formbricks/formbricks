import "server-only";

import jwt from "jsonwebtoken";
import { ConfigurationError } from "@formbricks/types/errors";
import { env } from "@/lib/env";

export const CUBE_CONFIGURATION_ERROR_MESSAGE =
  "Cube is not configured on this instance. Set CUBEJS_API_URL and CUBEJS_API_SECRET.";

export const normalizeCubeApiUrl = (baseUrl: string): string => {
  if (baseUrl.includes("/cubejs-api/v1")) {
    return baseUrl;
  }

  return `${baseUrl.replace(/\/$/, "")}/cubejs-api/v1`;
};

export const getCubeApiConfig = () => {
  if (!env.CUBEJS_API_URL || !env.CUBEJS_API_SECRET) {
    throw new ConfigurationError(CUBE_CONFIGURATION_ERROR_MESSAGE);
  }

  return {
    apiUrl: normalizeCubeApiUrl(env.CUBEJS_API_URL),
    apiSecret: env.CUBEJS_API_SECRET,
    token: jwt.sign({}, env.CUBEJS_API_SECRET, { algorithm: "HS256" }),
  };
};
