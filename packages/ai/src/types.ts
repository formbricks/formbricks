import type { LanguageModel, generateText } from "ai";

export const AI_PROVIDERS = ["aws", "gcp", "azure"] as const;

export type ActiveAIProvider = (typeof AI_PROVIDERS)[number];

export interface AIEnvironment {
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  AI_GCP_PROJECT?: string;
  AI_GCP_LOCATION?: string;
  AI_GCP_CREDENTIALS_JSON?: string;
  AI_GCP_APPLICATION_CREDENTIALS?: string;
  AI_AWS_REGION?: string;
  AI_AWS_ACCESS_KEY_ID?: string;
  AI_AWS_SECRET_ACCESS_KEY?: string;
  AI_AWS_SESSION_TOKEN?: string;
  AI_AZURE_BASE_URL?: string;
  AI_AZURE_RESOURCE_NAME?: string;
  AI_AZURE_API_KEY?: string;
  AI_AZURE_API_VERSION?: string;
}

export type AIProviderStatusErrorCode = "missingCredentials" | "invalidCredentials" | "missingModel";

export interface AIProviderStatus {
  provider: ActiveAIProvider;
  isConfigured: boolean;
  model: string | null;
  missingFields: string[];
  invalidFields: string[];
  errorCode?: AIProviderStatusErrorCode;
}

export type AIConfigurationErrorCode = "providerMissing" | "invalidProvider" | "providerNotConfigured";

export interface AIConfigurationStatus {
  provider: ActiveAIProvider | null;
  model: string | null;
  isConfigured: boolean;
  missingFields: string[];
  invalidFields: string[];
  errorCode?: AIConfigurationErrorCode;
  providerStatus?: AIProviderStatus;
}

export type AILanguageModel = LanguageModel;
export type TGenerateTextOptions = Omit<Parameters<typeof generateText>[0], "model">;
export type TGenerateTextResult = Awaited<ReturnType<typeof generateText>>;
