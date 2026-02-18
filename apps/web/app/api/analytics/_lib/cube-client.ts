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
  console.log(`[CubeClient] Connecting to ${API_URL} (token ${token ? "set" : "empty"})`);
  return cubejs(token, {
    apiUrl: API_URL,
  });
}

/**
 * Execute a Cube.js query and return the table pivot data.
 */
export async function executeQuery(query: Query) {
  console.log("[CubeClient] executeQuery called with:", JSON.stringify(query, null, 2));
  const client = createCubeClient();
  try {
    const resultSet = await client.load(query);
    const rows = resultSet.tablePivot();
    console.log(`[CubeClient] Query succeeded — ${rows.length} row(s) returned`);
    return rows;
  } catch (error) {
    console.error("[CubeClient] Query failed:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      apiUrl: API_URL,
      query,
    });
    throw error;
  }
}
