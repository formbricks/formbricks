import cubejs, { type CubeApi, type Query } from "@cubejs-client/core";
import { ConfigurationError, QueryExecutionError } from "@formbricks/types/errors";
import { createCubeApiToken, getCubeApiCredentials } from "./cube-config";

const CUBE_QUERY_ERROR_MESSAGE =
  "Cube query failed. Verify CUBEJS_API_URL and CUBEJS_API_SECRET, and ensure the Cube service is running.";
const CUBE_CLIENT_REFRESH_BUFFER_MS = 60 * 1000;

const globalForCube = globalThis as unknown as {
  formbricksCubeClient: CubeApi | undefined;
  formbricksCubeClientCacheKey: string | undefined;
  formbricksCubeClientTokenExpiresAtMs: number | undefined;
};

let cubeClient: CubeApi | null = globalForCube.formbricksCubeClient ?? null;
let cubeClientCacheKey: string | null = globalForCube.formbricksCubeClientCacheKey ?? null;
let cubeClientTokenExpiresAtMs = globalForCube.formbricksCubeClientTokenExpiresAtMs ?? 0;

const isCachedClientReusable = (cacheKey: string, nowMs: number): boolean =>
  cubeClient !== null &&
  cubeClientCacheKey === cacheKey &&
  cubeClientTokenExpiresAtMs > nowMs + CUBE_CLIENT_REFRESH_BUFFER_MS;

const cacheCubeClient = (client: CubeApi, cacheKey: string, tokenExpiresAtMs: number): CubeApi => {
  cubeClient = client;
  cubeClientCacheKey = cacheKey;
  cubeClientTokenExpiresAtMs = tokenExpiresAtMs;
  globalForCube.formbricksCubeClient = client;
  globalForCube.formbricksCubeClientCacheKey = cacheKey;
  globalForCube.formbricksCubeClientTokenExpiresAtMs = tokenExpiresAtMs;
  return client;
};

function getCubeClient(): CubeApi {
  const { apiSecret, apiUrl } = getCubeApiCredentials();
  const nowMs = Date.now();
  const cacheKey = `${apiUrl}:${apiSecret}`;

  if (isCachedClientReusable(cacheKey, nowMs)) {
    return cubeClient as CubeApi;
  }

  const { token, tokenExpiresAtMs } = createCubeApiToken(apiSecret);
  return cacheCubeClient(cubejs(token, { apiUrl }), cacheKey, tokenExpiresAtMs);
}

export async function executeQuery(query: Query) {
  try {
    const client = getCubeClient();
    const resultSet = await client.load(query);
    return resultSet.tablePivot();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }

    const detail = error instanceof Error && error.message ? ` Details: ${error.message}` : "";
    throw new QueryExecutionError(`${CUBE_QUERY_ERROR_MESSAGE}${detail}`);
  }
}
