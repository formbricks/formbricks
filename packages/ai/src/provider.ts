import type { LanguageModel } from "ai";
import { AIConfigurationError } from "./errors";
import { getAIProviderAdapter } from "./registry";
import { getAIEnvironment, isAIProvider, normalizeValue, resolveActiveAIProvider } from "./shared";
import type {
  AIConfigurationStatus,
  AIEnvironment,
  AILanguageModel,
  AIProviderStatus,
  ActiveAIProvider,
} from "./types";
import { AI_PROVIDERS } from "./types";

const MAX_LANGUAGE_MODEL_CACHE_ENTRIES = 50;
const languageModelCache = new Map<string, LanguageModel>();

export { AIConfigurationError };

const getProviderMissingAndInvalidFields = (
  provider: ActiveAIProvider,
  environment: AIEnvironment
): { missingFields: string[]; invalidFields: string[]; model: string | null } => {
  const adapter = getAIProviderAdapter(provider);
  const { missingFields: adapterMissingFields, invalidFields: adapterInvalidFields } =
    adapter.validate(environment);
  const missingFields = [...adapterMissingFields];
  const invalidFields = [...adapterInvalidFields];
  const model = normalizeValue(environment.AI_MODEL) ?? null;

  if (!model && !missingFields.includes("AI_MODEL")) {
    missingFields.push("AI_MODEL");
  }

  return {
    model,
    missingFields,
    invalidFields,
  };
};

const getProviderStatus = (provider: ActiveAIProvider, environment?: AIEnvironment): AIProviderStatus => {
  const resolvedEnvironment = getAIEnvironment(environment);
  const { missingFields, invalidFields, model } = getProviderMissingAndInvalidFields(
    provider,
    resolvedEnvironment
  );

  let errorCode: AIProviderStatus["errorCode"];

  if (invalidFields.length > 0) {
    errorCode = "invalidCredentials";
  } else if (missingFields.includes("AI_MODEL")) {
    errorCode = "missingModel";
  } else if (missingFields.length > 0) {
    errorCode = "missingCredentials";
  }

  return {
    provider,
    isConfigured: missingFields.length === 0 && invalidFields.length === 0,
    model,
    missingFields,
    invalidFields,
    ...(errorCode ? { errorCode } : {}),
  };
};

const getAIConfigurationErrorMessage = (status: AIConfigurationStatus): string => {
  switch (status.errorCode) {
    case "providerMissing":
      return "AI_PROVIDER is required";
    case "invalidProvider":
      return `AI_PROVIDER must be one of: ${AI_PROVIDERS.join(", ")}`;
    case "providerNotConfigured": {
      const parts = ["Active AI provider is not configured correctly."];

      if (status.missingFields.length > 0) {
        parts.push(`Missing: ${status.missingFields.join(", ")}`);
      }

      if (status.invalidFields.length > 0) {
        parts.push(`Invalid: ${status.invalidFields.join(", ")}`);
      }

      return parts.join(" ");
    }
    default:
      return "AI is not configured";
  }
};

const getCachedLanguageModel = (cacheKey: string): LanguageModel | undefined => {
  const cachedLanguageModel = languageModelCache.get(cacheKey);

  if (!cachedLanguageModel) {
    return undefined;
  }

  languageModelCache.delete(cacheKey);
  languageModelCache.set(cacheKey, cachedLanguageModel);

  return cachedLanguageModel;
};

const setCachedLanguageModel = (cacheKey: string, languageModel: LanguageModel): void => {
  if (languageModelCache.has(cacheKey)) {
    languageModelCache.delete(cacheKey);
  } else if (languageModelCache.size >= MAX_LANGUAGE_MODEL_CACHE_ENTRIES) {
    const oldestCacheKey = languageModelCache.keys().next().value;

    if (oldestCacheKey !== undefined) {
      languageModelCache.delete(oldestCacheKey);
    }
  }

  languageModelCache.set(cacheKey, languageModel);
};

export const getActiveAiProvider = (environment?: AIEnvironment): ActiveAIProvider | null => {
  return resolveActiveAIProvider(getAIEnvironment(environment).AI_PROVIDER);
};

export const getActiveAiModel = (environment?: AIEnvironment): string | null =>
  normalizeValue(getAIEnvironment(environment).AI_MODEL) ?? null;

export const getAiConfigurationStatus = (environment?: AIEnvironment): AIConfigurationStatus => {
  const resolvedEnvironment = getAIEnvironment(environment);
  const rawProvider = normalizeValue(resolvedEnvironment.AI_PROVIDER);
  const model = getActiveAiModel(resolvedEnvironment);

  if (!rawProvider) {
    return {
      provider: null,
      model,
      isConfigured: false,
      missingFields: ["AI_PROVIDER"],
      invalidFields: [],
      errorCode: "providerMissing",
    };
  }

  if (!isAIProvider(rawProvider)) {
    return {
      provider: null,
      model,
      isConfigured: false,
      missingFields: [],
      invalidFields: ["AI_PROVIDER"],
      errorCode: "invalidProvider",
    };
  }

  const providerStatus = getProviderStatus(rawProvider, resolvedEnvironment);

  if (!providerStatus.isConfigured) {
    return {
      provider: rawProvider,
      model: providerStatus.model,
      isConfigured: false,
      missingFields: providerStatus.missingFields,
      invalidFields: providerStatus.invalidFields,
      providerStatus,
      errorCode: "providerNotConfigured",
    };
  }

  return {
    provider: rawProvider,
    model: providerStatus.model,
    isConfigured: true,
    missingFields: [],
    invalidFields: [],
    providerStatus,
  };
};

export const isAiConfigured = (environment?: AIEnvironment): boolean =>
  getAiConfigurationStatus(environment).isConfigured;

export const getAiModel = (environment?: AIEnvironment): AILanguageModel => {
  const resolvedEnvironment = getAIEnvironment(environment);
  const configurationStatus = getAiConfigurationStatus(resolvedEnvironment);
  const normalizedModelName = configurationStatus.model;

  if (!configurationStatus.isConfigured || !configurationStatus.provider) {
    throw new AIConfigurationError(
      configurationStatus.errorCode ?? "providerNotConfigured",
      getAIConfigurationErrorMessage(configurationStatus),
      {
        provider: configurationStatus.provider,
        model: configurationStatus.model,
        missingFields: configurationStatus.missingFields,
        invalidFields: configurationStatus.invalidFields,
      }
    );
  }

  if (!normalizedModelName) {
    throw new AIConfigurationError(
      "providerNotConfigured",
      getAIConfigurationErrorMessage(configurationStatus),
      {
        provider: configurationStatus.provider,
        model: null,
        missingFields: configurationStatus.missingFields,
        invalidFields: configurationStatus.invalidFields,
      }
    );
  }

  const providerAdapter = getAIProviderAdapter(configurationStatus.provider);
  const cacheKey = providerAdapter.buildCacheKey(normalizedModelName, resolvedEnvironment);
  const cachedLanguageModel = getCachedLanguageModel(cacheKey);

  if (cachedLanguageModel) {
    return cachedLanguageModel;
  }

  const languageModel = providerAdapter.createModel(normalizedModelName, resolvedEnvironment);

  setCachedLanguageModel(cacheKey, languageModel);

  return languageModel;
};

export const resetLanguageModelCache = (): void => {
  languageModelCache.clear();
};
