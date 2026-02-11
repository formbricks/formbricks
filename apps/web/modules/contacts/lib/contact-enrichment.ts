import { TBatchEnrichmentResponse, TEnrichmentConfig, TEnrichmentResult } from "../types/enrichment";

/**
 * Enriches a single contact record from an external API
 */
export async function enrichContactFromAPI(
  record: Record<string, string>,
  config: TEnrichmentConfig
): Promise<TEnrichmentResult> {
  try {
    const lookupValue = record[config.lookupColumn];

    if (!lookupValue) {
      return {
        success: false,
        originalData: record,
        error: `Missing lookup value for column: ${config.lookupColumn}`,
      };
    }

    // Build request URL
    let url = config.apiUrl;
    if (config.apiMethod === "GET") {
      // For GET requests, append lookup value as query parameter
      const urlObj = new URL(url);
      urlObj.searchParams.append(config.lookupColumn, lookupValue);
      url = urlObj.toString();
    }

    // Build request headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add authentication headers
    if (config.authType === "bearer" && config.authValue) {
      headers["Authorization"] = `Bearer ${config.authValue}`;
    } else if (config.authType === "apiKey" && config.authValue) {
      headers["X-API-Key"] = config.authValue;
    } else if (config.authType === "basic" && config.authValue) {
      headers["Authorization"] = `Basic ${config.authValue}`;
    }

    // Build request body for POST
    let body: string | undefined;
    if (config.apiMethod === "POST") {
      if (config.requestBodyTemplate) {
        // Replace placeholder with actual lookup value
        body = config.requestBodyTemplate.replace("{{lookupValue}}", lookupValue);
      } else {
        body = JSON.stringify({ [config.lookupColumn]: lookupValue });
      }
    }

    // Make API request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const response = await fetch(url, {
      method: config.apiMethod,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const apiData = await response.json();

    // Map API response to contact attributes
    const enrichedData = { ...record };
    Object.entries(config.responseMapping).forEach(([apiField, contactAttribute]) => {
      // Support nested field access with dot notation (e.g., "user.name")
      const value = getNestedValue(apiData, apiField);
      if (value !== undefined && value !== null) {
        enrichedData[contactAttribute] = String(value);
      }
    });

    return {
      success: true,
      originalData: record,
      enrichedData,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      originalData: record,
      error: errorMessage,
    };
  }
}

/**
 * Enriches multiple contact records in batch
 */
export async function enrichContactsBatch(
  records: Record<string, string>[],
  config: TEnrichmentConfig,
  options?: {
    maxConcurrent?: number;
    onProgress?: (processed: number, total: number) => void;
  }
): Promise<TBatchEnrichmentResponse> {
  const maxConcurrent = options?.maxConcurrent ?? 5;
  const results: TEnrichmentResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  // Process records in batches to avoid overwhelming the API
  for (let i = 0; i < records.length; i += maxConcurrent) {
    const batch = records.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(batch.map((record) => enrichContactFromAPI(record, config)));

    results.push(...batchResults);
    successCount += batchResults.filter((r) => r.success).length;
    errorCount += batchResults.filter((r) => !r.success).length;

    if (options?.onProgress) {
      options.onProgress(results.length, records.length);
    }
  }

  return {
    results,
    totalProcessed: records.length,
    successCount,
    errorCount,
  };
}

/**
 * Helper function to get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Validates enrichment configuration
 */
export function validateEnrichmentConfig(config: Partial<TEnrichmentConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.apiUrl) {
    errors.push("API URL is required");
  } else {
    try {
      new URL(config.apiUrl);
    } catch {
      errors.push("Invalid API URL format");
    }
  }

  if (!config.apiMethod) {
    errors.push("API method is required");
  }

  if (!config.lookupColumn) {
    errors.push("Lookup column is required");
  }

  if (config.authType && config.authType !== "none" && !config.authValue) {
    errors.push("Authentication value is required when auth type is specified");
  }

  if (!config.responseMapping || Object.keys(config.responseMapping).length === 0) {
    errors.push("At least one response mapping is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
