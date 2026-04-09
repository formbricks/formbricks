import { awsProviderAdapter } from "./providers/aws";
import { azureProviderAdapter } from "./providers/azure";
import { gcpProviderAdapter } from "./providers/gcp";
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
  gcp: gcpProviderAdapter,
  azure: azureProviderAdapter,
};

export const getAIProviderAdapter = (provider: ActiveAIProvider): AIProviderAdapter =>
  AI_PROVIDER_REGISTRY[provider];
