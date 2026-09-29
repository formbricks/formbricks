import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { AIConfigurationError } from "../errors";
import { type OAuthClientCredentialsConfig, createOAuthFetch, createOAuthTokenSource } from "../oauth-token";
import type { AIProviderAdapter } from "../registry";
import {
  OPENAI_COMPATIBLE_AUTH_MODES,
  getCredentialFingerprint,
  isValidHttpUrl,
  normalizeValue,
  parseAuthMode,
  parseAuthStyle,
  parseBooleanFlag,
  parseStringRecordJson,
} from "../shared";
import type { AIEnvironment } from "../types";

const DEFAULT_PROVIDER_NAME = "openai-compatible";

const isStringRecordJson = (value: string): boolean => {
  try {
    parseStringRecordJson(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Oauth2-client-credentials fields. Only consulted in that mode, so a stray OAUTH_* variable in
 * api-key mode changes nothing.
 */
const validateOAuthFields = (
  environment: AIEnvironment,
  missingFields: string[],
  invalidFields: string[]
): void => {
  const tokenUrl = normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_TOKEN_URL);

  if (!tokenUrl) {
    missingFields.push("AI_OPENAI_COMPATIBLE_OAUTH_TOKEN_URL");
  } else if (!isValidHttpUrl(tokenUrl)) {
    invalidFields.push("AI_OPENAI_COMPATIBLE_OAUTH_TOKEN_URL");
  }

  if (!normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_CLIENT_ID)) {
    missingFields.push("AI_OPENAI_COMPATIBLE_OAUTH_CLIENT_ID");
  }

  if (!normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_CLIENT_SECRET)) {
    missingFields.push("AI_OPENAI_COMPATIBLE_OAUTH_CLIENT_SECRET");
  }

  if (!parseAuthStyle(environment.AI_OPENAI_COMPATIBLE_OAUTH_AUTH_STYLE)) {
    invalidFields.push("AI_OPENAI_COMPATIBLE_OAUTH_AUTH_STYLE");
  }

  const extraParamsJson = normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_EXTRA_PARAMS_JSON);

  if (extraParamsJson && !isStringRecordJson(extraParamsJson)) {
    invalidFields.push("AI_OPENAI_COMPATIBLE_OAUTH_EXTRA_PARAMS_JSON");
  }

  // One source of the Authorization header: a static key alongside OAuth is a misconfiguration.
  if (normalizeValue(environment.AI_OPENAI_COMPATIBLE_API_KEY)) {
    invalidFields.push("AI_OPENAI_COMPATIBLE_API_KEY");
  }
};

const buildOAuthConfig = (environment: AIEnvironment): OAuthClientCredentialsConfig => {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];
  validateOAuthFields(environment, missingFields, invalidFields);

  const tokenUrl = normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_TOKEN_URL);
  const clientId = normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_CLIENT_ID);
  const clientSecret = normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_CLIENT_SECRET);
  const authStyle = parseAuthStyle(environment.AI_OPENAI_COMPATIBLE_OAUTH_AUTH_STYLE);

  if (
    missingFields.length > 0 ||
    invalidFields.length > 0 ||
    !tokenUrl ||
    !clientId ||
    !clientSecret ||
    !authStyle
  ) {
    throw new AIConfigurationError(
      "providerNotConfigured",
      "OpenAI-compatible OAuth2 client-credentials configuration is incomplete or invalid",
      { provider: "openai-compatible", missingFields, invalidFields }
    );
  }

  const extraParamsJson = normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_EXTRA_PARAMS_JSON);
  const scope = normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_SCOPE);

  return {
    tokenUrl,
    clientId,
    clientSecret,
    authStyle,
    ...(scope ? { scope } : {}),
    ...(extraParamsJson ? { extraParams: parseStringRecordJson(extraParamsJson) } : {}),
  };
};

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

    const authMode = parseAuthMode(environment.AI_OPENAI_COMPATIBLE_AUTH_MODE);

    if (!authMode) {
      invalidFields.push("AI_OPENAI_COMPATIBLE_AUTH_MODE");
    } else if (authMode === "oauth2-client-credentials") {
      validateOAuthFields(environment, missingFields, invalidFields);
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
      authMode: normalizeValue(environment.AI_OPENAI_COMPATIBLE_AUTH_MODE),
      oauthTokenUrl: normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_TOKEN_URL),
      oauthClientId: normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_CLIENT_ID),
      oauthScope: normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_SCOPE),
      oauthAuthStyle: normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_AUTH_STYLE),
      oauthExtraParamsJson: normalizeValue(environment.AI_OPENAI_COMPATIBLE_OAUTH_EXTRA_PARAMS_JSON),
      // A rotated secret must build a new model (and with it a new token source); the token itself
      // never enters the key.
      oauthClientSecretFingerprint: getCredentialFingerprint(
        environment.AI_OPENAI_COMPATIBLE_OAUTH_CLIENT_SECRET
      ),
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

    const authMode = parseAuthMode(environment.AI_OPENAI_COMPATIBLE_AUTH_MODE);

    if (!authMode) {
      throw new AIConfigurationError(
        "providerNotConfigured",
        `AI_OPENAI_COMPATIBLE_AUTH_MODE must be one of: ${OPENAI_COMPATIBLE_AUTH_MODES.join(", ")}`,
        {
          provider: "openai-compatible",
          invalidFields: ["AI_OPENAI_COMPATIBLE_AUTH_MODE"],
        }
      );
    }

    if (authMode === "oauth2-client-credentials") {
      // No apiKey: the fetch wrapper is the only thing that sets Authorization. The token source
      // lives in this closure, so it is cached together with the model in provider.ts.
      const oauthFetch = createOAuthFetch(createOAuthTokenSource(buildOAuthConfig(environment)));

      return createOpenAICompatible({
        name: providerName,
        baseURL,
        supportsStructuredOutputs,
        fetch: oauthFetch,
        ...(headers ? { headers } : {}),
        ...(queryParams ? { queryParams } : {}),
      })(model);
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
