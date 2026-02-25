import cubejs, { type CubeApi, type Query } from "@cubejs-client/core";

const getApiUrl = (): string => {
  const baseUrl = process.env.CUBEJS_API_URL || "http://localhost:4000";
  if (baseUrl.includes("/cubejs-api/v1")) {
    return baseUrl;
  }
  return `${baseUrl.replace(/\/$/, "")}/cubejs-api/v1`;
};

let cubeClient: CubeApi | null = null;

function getCubeClient(): CubeApi {
  if (!cubeClient) {
    // TODO: This will fail silently if the token is not set. We need to fix this before going to production.
    const token = process.env.CUBEJS_API_TOKEN ?? "";
    cubeClient = cubejs(token, { apiUrl: getApiUrl() });
  }
  return cubeClient;
}

export async function executeQuery(query: Query) {
  const client = getCubeClient();
  const resultSet = await client.load(query);
  return resultSet.tablePivot();
}
