import { awsProviderAdapter } from "./providers/aws";
import { azureProviderAdapter } from "./providers/azure";
import { googleProviderAdapter } from "./providers/google";
import { openaiCompatibleProviderAdapter } from "./providers/openai-compatible";
import type { AIEnvironment, AILanguageModel, ActiveAIProvider } from "./types";

export interface AIProviderValidationResult {
  missingFields: string[];
  invalidFields: string[];
}

export interface AIProviderAdapter {
  validate: (environment: AIEnvironment) => AIProviderValidationResult;
  buildCacheKey: (model: string, environment: AIEnvironment) => string;
  createModel: (model: string, environment: AIEnvironment) => AILanguageModel;
}

const AI_PROVIDER_REGISTRY: Record<ActiveAIProvider, AIProviderAdapter> = {
  aws: awsProviderAdapter,
  google: googleProviderAdapter,
  azure: azureProviderAdapter,
  "openai-compatible": openaiCompatibleProviderAdapter,
};

export const getAIProviderAdapter = (provider: ActiveAIProvider): AIProviderAdapter =>
  AI_PROVIDER_REGISTRY[provider];
