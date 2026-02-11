import type { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import type { TSurveyLogicActionCallExternalAPI } from "@formbricks/types/surveys/logic";
import type { TExternalDataSource, TExternalDataSourceAuth } from "@formbricks/types/surveys/types";

interface ExternalAPICallParams {
  externalDataSource: TExternalDataSource;
  parametersMapping: TSurveyLogicActionCallExternalAPI["parametersMapping"];
  responseData: TResponseData;
  variables: TResponseVariables;
  hiddenFields: Record<string, string>;
}

interface ExternalAPICallResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  updatedVariables?: TResponseVariables;
}

/**
 * Resolves parameter values from response data, variables, or hidden fields
 */
function resolveParameterValue(
  source: TSurveyLogicActionCallExternalAPI["parametersMapping"][0]["source"],
  responseData: TResponseData,
  variables: TResponseVariables,
  hiddenFields: Record<string, string>
): string | number | undefined {
  switch (source.type) {
    case "element": {
      const value = responseData[source.elementId];
      return typeof value === "string" || typeof value === "number" ? value : undefined;
    }
    case "variable": {
      const variable = variables[source.variableId];
      return variable !== undefined ? variable : undefined;
    }
    case "hiddenField": {
      return hiddenFields[source.fieldId];
    }
    default:
      return undefined;
  }
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
  fieldMappings: TExternalDataSource["fieldMappings"],
  currentVariables: TResponseVariables
): TResponseVariables {
  const updatedVariables = { ...currentVariables };

  fieldMappings.forEach((mapping) => {
    const value = extractFieldValue(responseData, mapping.responseField);
    if (value !== undefined) {
      updatedVariables[mapping.variableId] = value;
    }
  });

  return updatedVariables;
}

/**
 * Calls an external API and updates survey variables with the response
 */
export async function callExternalAPI({
  externalDataSource,
  parametersMapping,
  responseData,
  variables,
  hiddenFields,
}: ExternalAPICallParams): Promise<ExternalAPICallResult> {
  try {
    // Resolve all parameter values
    const params: Record<string, string | number> = {};
    for (const mapping of parametersMapping) {
      const value = resolveParameterValue(mapping.source, responseData, variables, hiddenFields);
      if (value !== undefined) {
        params[mapping.urlParam] = value;
      }
    }

    // Build request
    let url = externalDataSource.url;
    let body: string | undefined;

    if (externalDataSource.method === "GET") {
      url = buildURL(url, params);
    } else if (externalDataSource.method === "POST") {
      body = JSON.stringify(params);
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
        error: `API request failed with status ${response.status}`,
      };
    }

    const data = await response.json();

    // Map response to variables
    const updatedVariables = mapResponseToVariables(data, externalDataSource.fieldMappings, variables);

    return {
      success: true,
      data,
      updatedVariables,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Tests an external API connection
 */
export async function testExternalAPIConnection(
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
