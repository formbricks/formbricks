import type { TExternalDataSource, TExternalDataSourceAuth } from "@formbricks/types/surveys/types";

interface FetchExternalDataParams {
  externalDataSource: TExternalDataSource;
  parameters: Record<string, string | number>;
}

interface FetchExternalDataResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  mappedVariables?: Record<string, any>;
}

/**
 * Builds the URL with query parameters
 */
function buildURL(baseUrl: string, params: Record<string, string | number>): string {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, String(value));
  });
  return url.toString();
}

/**
 * Builds request headers including authentication
 */
function buildHeaders(auth: TExternalDataSourceAuth, customHeaders?: Record<string, string>): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  switch (auth.type) {
    case "bearer":
      headers["Authorization"] = `Bearer ${auth.token}`;
      break;
    case "apiKey":
      if (auth.in === "header") {
        headers[auth.key] = auth.value;
      }
      break;
  }

  return headers;
}

/**
 * Extracts a value from a nested object using dot notation
 * e.g., "user.name" will extract obj.user.name
 */
function extractFieldValue(obj: any, path: string): any {
  const keys = path.split(".");
  let value = obj;

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Maps API response fields to survey variables
 */
function mapResponseToVariables(
  responseData: any,
  fieldMappings: TExternalDataSource["fieldMappings"]
): Record<string, any> {
  const mappedVariables: Record<string, any> = {};

  fieldMappings.forEach((mapping) => {
    const value = extractFieldValue(responseData, mapping.responseField);
    if (value !== undefined) {
      mappedVariables[mapping.variableId] = value;
    }
  });

  return mappedVariables;
}

/**
 * Fetches data from an external API (server-side)
 */
export async function fetchExternalData({
  externalDataSource,
  parameters,
}: FetchExternalDataParams): Promise<FetchExternalDataResult> {
  try {
    // Build request
    let url = externalDataSource.url;
    let body: string | undefined;

    if (externalDataSource.method === "GET") {
      url = buildURL(url, parameters);
    } else if (externalDataSource.method === "POST") {
      body = JSON.stringify(parameters);
    }

    // Add API key to query string if needed
    if (externalDataSource.auth.type === "apiKey" && externalDataSource.auth.in === "query") {
      const urlObj = new URL(url);
      urlObj.searchParams.append(externalDataSource.auth.key, externalDataSource.auth.value);
      url = urlObj.toString();
    }

    const headers = buildHeaders(externalDataSource.auth, externalDataSource.headers);

    // Make API call
    const response = await fetch(url, {
      method: externalDataSource.method,
      headers,
      body,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API request failed with status ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Map response to variables
    const mappedVariables = mapResponseToVariables(data, externalDataSource.fieldMappings);

    return {
      success: true,
      data,
      mappedVariables,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Tests an external API connection (server-side)
 */
export async function testExternalDataConnection(
  externalDataSource: TExternalDataSource,
  testParams: Record<string, string | number> = {}
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    let url = externalDataSource.url;
    let body: string | undefined;

    if (externalDataSource.method === "GET") {
      url = buildURL(url, testParams);
    } else if (externalDataSource.method === "POST") {
      body = JSON.stringify(testParams);
    }

    // Add API key to query string if needed
    if (externalDataSource.auth.type === "apiKey" && externalDataSource.auth.in === "query") {
      const urlObj = new URL(url);
      urlObj.searchParams.append(externalDataSource.auth.key, externalDataSource.auth.value);
      url = urlObj.toString();
    }

    const headers = buildHeaders(externalDataSource.auth, externalDataSource.headers);

    const response = await fetch(url, {
      method: externalDataSource.method,
      headers,
      body,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API request failed with status ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
