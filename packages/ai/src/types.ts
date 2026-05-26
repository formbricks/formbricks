import type { LanguageModel, generateObject, generateText } from "ai";
import type { z } from "zod";

export const AI_PROVIDERS = ["aws", "google", "azure"] as const;

export type ActiveAIProvider = (typeof AI_PROVIDERS)[number];

export interface AIEnvironment {
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  AI_GOOGLE_CLOUD_PROJECT?: string;
  AI_GOOGLE_CLOUD_LOCATION?: string;
  AI_GOOGLE_CLOUD_CREDENTIALS_JSON?: string;
  AI_GOOGLE_CLOUD_APPLICATION_CREDENTIALS?: string;
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

// Strongly-typed generateObject options/result. The caller passes a zod schema
// for `schema`; the SDK validates / retries until the LLM produces output that
// parses. `output` is constrained to "object" for the wrapper — the array /
// enum / no-schema variants of generateObject are intentionally not exposed
// here to keep the API surface small.
export type TGenerateObjectOptions<T> = Omit<Parameters<typeof generateObject>[0], "model" | "schema"> & {
  schema: z.ZodType<T>;
};
export type TGenerateObjectResult<T> = { object: T } & Omit<
  Awaited<ReturnType<typeof generateObject>>,
  "object"
>;
