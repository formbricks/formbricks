import cubejs, { Query } from "@cubejs-client/core";

/**
 * Cube.js client for executing analytics queries.
 *
 * Authentication is handled via the CUBEJS_API_SECRET env var which must match
 * the secret configured on the Cube.js server. In development an empty token is
 * accepted when the Cube.js instance runs in dev mode.
 */

const getApiUrl = () => {
  const baseUrl = process.env.CUBEJS_API_URL || "http://localhost:4000";
  if (baseUrl.includes("/cubejs-api/v1")) {
    return baseUrl;
  }
  return `${baseUrl.replace(/\/$/, "")}/cubejs-api/v1`;
};

const API_URL = getApiUrl();

export function createCubeClient() {
  const token = process.env.CUBEJS_API_TOKEN ?? "";
  return cubejs(token, {
    apiUrl: API_URL,
  });
}

/**
 * Execute a Cube.js query and return the table pivot data.
 */
export async function executeQuery(query: Query) {
  const client = createCubeClient();
  const resultSet = await client.load(query);
  return resultSet.tablePivot();
}
