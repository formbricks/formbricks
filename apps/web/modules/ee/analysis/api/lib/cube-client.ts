import cubejs, { type CubeApi, type Query } from "@cubejs-client/core";
import { ConfigurationError, QueryExecutionError } from "@formbricks/types/errors";
import { getCubeApiConfig } from "./cube-config";

const CUBE_QUERY_ERROR_MESSAGE =
  "Cube query failed. Verify CUBEJS_API_URL and CUBEJS_API_SECRET, and ensure the Cube service is running.";

function getCubeClient(): CubeApi {
  const { apiUrl, token } = getCubeApiConfig();
  return cubejs(token, { apiUrl });
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
