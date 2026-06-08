import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { AIConfigurationError } from "../errors";
import type { AIProviderAdapter } from "../registry";
import {
  getCredentialFingerprint,
  isValidHttpUrl,
  normalizeValue,
  parseBooleanFlag,
  parseStringRecordJson,
} from "../shared";
import type { AIEnvironment } from "../types";

const DEFAULT_PROVIDER_NAME = "openai-compatible";

export const openaiCompatibleProviderAdapter: AIProviderAdapter = {
  validate: (environment: AIEnvironment) => {
    const missingFields: string[] = [];
    const invalidFields: string[] = [];

    const baseURL = normalizeValue(environment.AI_OPENAI_COMPATIBLE_BASE_URL);

    if (!baseURL) {
      missingFields.push("AI_OPENAI_COMPATIBLE_BASE_URL");
    } else if (!isValidHttpUrl(baseURL)) {
      invalidFields.push("AI_OPENAI_COMPATIBLE_BASE_URL");
    }

    const headersJson = normalizeValue(environment.AI_OPENAI_COMPATIBLE_HEADERS_JSON);

    if (headersJson) {
      try {
        parseStringRecordJson(headersJson);
      } catch {
        invalidFields.push("AI_OPENAI_COMPATIBLE_HEADERS_JSON");
      }
    }

    const queryParamsJson = normalizeValue(environment.AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON);

    if (queryParamsJson) {
      try {
        parseStringRecordJson(queryParamsJson);
      } catch {
        invalidFields.push("AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON");
      }
    }

    return {
      missingFields,
      invalidFields,
    };
  },
  buildCacheKey: (model: string, environment: AIEnvironment) =>
    JSON.stringify({
      provider: "openai-compatible",
      model,
      baseURL: normalizeValue(environment.AI_OPENAI_COMPATIBLE_BASE_URL),
      providerName: normalizeValue(environment.AI_OPENAI_COMPATIBLE_PROVIDER_NAME) ?? DEFAULT_PROVIDER_NAME,
      supportsStructuredOutputs: parseBooleanFlag(
        environment.AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS
      ),
      headersJson: normalizeValue(environment.AI_OPENAI_COMPATIBLE_HEADERS_JSON),
      queryParamsJson: normalizeValue(environment.AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON),
      apiKeyFingerprint: getCredentialFingerprint(environment.AI_OPENAI_COMPATIBLE_API_KEY),
    }),
  createModel: (model: string, environment: AIEnvironment) => {
    const baseURL = normalizeValue(environment.AI_OPENAI_COMPATIBLE_BASE_URL);
    const apiKey = normalizeValue(environment.AI_OPENAI_COMPATIBLE_API_KEY);
    const providerName =
      normalizeValue(environment.AI_OPENAI_COMPATIBLE_PROVIDER_NAME) ?? DEFAULT_PROVIDER_NAME;
    const headersJson = normalizeValue(environment.AI_OPENAI_COMPATIBLE_HEADERS_JSON);
    const queryParamsJson = normalizeValue(environment.AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON);
    const supportsStructuredOutputs = parseBooleanFlag(
      environment.AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS
    );

    if (!baseURL) {
      throw new AIConfigurationError(
        "providerNotConfigured",
        "OpenAI-compatible provider is missing the base URL",
        {
          provider: "openai-compatible",
          missingFields: ["AI_OPENAI_COMPATIBLE_BASE_URL"],
        }
      );
    }

    if (!isValidHttpUrl(baseURL)) {
      throw new AIConfigurationError(
        "providerNotConfigured",
        "AI_OPENAI_COMPATIBLE_BASE_URL must be a valid http(s) URL",
        {
          provider: "openai-compatible",
          invalidFields: ["AI_OPENAI_COMPATIBLE_BASE_URL"],
        }
      );
    }

    let headers: Record<string, string> | undefined;

    if (headersJson) {
      try {
        headers = parseStringRecordJson(headersJson);
      } catch {
        throw new AIConfigurationError(
          "providerNotConfigured",
          "AI_OPENAI_COMPATIBLE_HEADERS_JSON must be a JSON object of string values",
          {
            provider: "openai-compatible",
            invalidFields: ["AI_OPENAI_COMPATIBLE_HEADERS_JSON"],
          }
        );
      }
    }

    let queryParams: Record<string, string> | undefined;

    if (queryParamsJson) {
      try {
        queryParams = parseStringRecordJson(queryParamsJson);
      } catch {
        throw new AIConfigurationError(
          "providerNotConfigured",
          "AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON must be a JSON object of string values",
          {
            provider: "openai-compatible",
            invalidFields: ["AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON"],
          }
        );
      }
    }

    const openaiCompatible = createOpenAICompatible({
      name: providerName,
      baseURL,
      supportsStructuredOutputs,
      ...(apiKey ? { apiKey } : {}),
      ...(headers ? { headers } : {}),
      ...(queryParams ? { queryParams } : {}),
    });

    return openaiCompatible(model);
  },
};
