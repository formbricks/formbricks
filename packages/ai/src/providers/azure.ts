import { createAzure } from "@ai-sdk/azure";
import { AIConfigurationError } from "../errors";
import type { AIProviderAdapter } from "../registry";
import { normalizeValue } from "../shared";
import type { AIEnvironment } from "../types";

export const azureProviderAdapter: AIProviderAdapter = {
  validate: (environment: AIEnvironment) => {
    const missingFields: string[] = [];

    if (!normalizeValue(environment.AZURE_API_KEY)) {
      missingFields.push("AZURE_API_KEY");
    }

    if (!normalizeValue(environment.AZURE_BASE_URL) && !normalizeValue(environment.AZURE_RESOURCE_NAME)) {
      missingFields.push("AZURE_BASE_URL or AZURE_RESOURCE_NAME");
    }

    return {
      missingFields,
      invalidFields: [],
    };
  },
  buildCacheKey: (model: string, environment: AIEnvironment) =>
    JSON.stringify({
      provider: "azure",
      model,
      baseURL: normalizeValue(environment.AZURE_BASE_URL),
      resourceName: normalizeValue(environment.AZURE_RESOURCE_NAME),
      apiVersion: normalizeValue(environment.AZURE_API_VERSION),
    }),
  createModel: (model: string, environment: AIEnvironment) => {
    const apiKey = normalizeValue(environment.AZURE_API_KEY);
    const baseURL = normalizeValue(environment.AZURE_BASE_URL);
    const resourceName = normalizeValue(environment.AZURE_RESOURCE_NAME);
    const apiVersion = normalizeValue(environment.AZURE_API_VERSION);
    const hasEndpoint = (baseURL ?? resourceName) !== undefined;

    if (!apiKey || !hasEndpoint) {
      throw new AIConfigurationError("providerNotConfigured", "Azure AI credentials are incomplete", {
        provider: "azure",
        missingFields: [
          ...(apiKey ? [] : ["AZURE_API_KEY"]),
          ...(hasEndpoint ? [] : ["AZURE_BASE_URL or AZURE_RESOURCE_NAME"]),
        ],
      });
    }

    const azure = createAzure({
      apiKey,
      ...(baseURL ? { baseURL } : { resourceName }),
      ...(apiVersion ? { apiVersion } : {}),
    });

    return azure(model);
  },
};
