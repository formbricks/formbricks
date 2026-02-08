import cubejs from "@cubejs-client/core";

/**
 * Cube.js client for executing queries
 * No authentication - for POC purposes only
 */

// Cube API configuration - defaults to localhost:4000, can be overridden via env var
// Automatically append /cubejs-api/v1 if not present
const getApiUrl = () => {
  const baseUrl = process.env.CUBEJS_API_URL || "http://localhost:4000";
  // If the URL already contains /cubejs-api/v1, use it as-is
  if (baseUrl.includes("/cubejs-api/v1")) {
    return baseUrl;
  }
  // Otherwise, append the path
  return `${baseUrl.replace(/\/$/, "")}/cubejs-api/v1`;
};

const API_URL = getApiUrl();

/**
 * Create a Cube.js client instance without authentication
 * For POC - Cube.js must be configured to allow unauthenticated requests
 */
export function createCubeClient() {
  // Empty string = no authentication token
  return cubejs("", {
    apiUrl: API_URL,
  });
}

/**
 * Execute a Cube.js query and return the table pivot data
 * @param query - The Cube.js query object
 * @returns Array of row objects with measure/dimension values
 */
export async function executeQuery(query: any) {
  try {
    const client = createCubeClient();
    console.log("Executing Cube.js query:", JSON.stringify(query, null, 2));
    console.log("Cube.js API URL:", API_URL);
    const resultSet = await client.load(query);
    return resultSet.tablePivot();
  } catch (error: any) {
    console.error("Cube.js query error:", error);
    console.error("Query that failed:", JSON.stringify(query, null, 2));
    console.error("API URL used:", API_URL);
    throw error;
  }
}
