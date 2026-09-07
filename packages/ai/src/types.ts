import type {
  AsyncIterableStream,
  DeepPartial,
  FlexibleSchema,
  LanguageModel,
  generateText,
  streamText,
} from "ai";

export const AI_PROVIDERS = ["aws", "google", "azure", "openai-compatible"] as const;

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
  AI_OPENAI_COMPATIBLE_BASE_URL?: string;
  AI_OPENAI_COMPATIBLE_API_KEY?: string;
  AI_OPENAI_COMPATIBLE_PROVIDER_NAME?: string;
  AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS?: string;
  AI_OPENAI_COMPATIBLE_HEADERS_JSON?: string;
  AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON?: string;
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
export type AIResolvedLanguageModel = Exclude<LanguageModel, string>;
type GenerateTextResult = Awaited<ReturnType<typeof generateText>>;

export type TGenerateObjectOptions<T = unknown> = Omit<
  Parameters<typeof generateText>[0],
  "model" | "output" | "experimental_output"
> & {
  schema: FlexibleSchema<T>;
  schemaName?: string;
  schemaDescription?: string;
  output?: "object";
};
export interface TGenerateObjectResult<T = unknown> {
  readonly object: T;
  readonly reasoning: GenerateTextResult["reasoningText"];
  readonly finishReason: GenerateTextResult["finishReason"];
  readonly usage: GenerateTextResult["usage"];
  readonly warnings: GenerateTextResult["warnings"];
  readonly request: GenerateTextResult["request"];
  readonly response: GenerateTextResult["response"];
  readonly providerMetadata: GenerateTextResult["providerMetadata"];
  toJsonResponse: (init?: ResponseInit) => Response;
}
export type TGenerateTextOptions = Omit<Parameters<typeof generateText>[0], "model">;
export type TGenerateTextResult = GenerateTextResult;

export type TStreamObjectOptions<T = unknown> = Omit<
  Parameters<typeof streamText>[0],
  "model" | "output" | "experimental_output"
> & {
  schema: FlexibleSchema<T>;
  schemaName?: string;
  schemaDescription?: string;
  output?: "object";
};

export interface TStreamObjectResult<T = unknown> {
  /**
   * Whole-object snapshots as the model writes, not deltas. Deliberately unvalidated: the AI SDK
   * runs no schema check on partials, so a snapshot can carry a half-written string or a value that
   * is not yet a legal enum member. Treat it as display-only and read the final object from
   * `completion`.
   */
  readonly partialObjectStream: AsyncIterableStream<DeepPartial<T>>;
  /**
   * Resolves to the complete parsed object once the generation finishes. Rejects with
   * `AIOutputTokenLimitError` when the model hit the output token limit, with the provider error on
   * a provider failure, and with the abort reason when `abortSignal` fires.
   *
   * Intentionally narrower than `TGenerateObjectResult`: `warnings`, `request`, `response` and
   * `providerMetadata` all resolve through the SDK's `finalStep`, which drains the base stream as a
   * side effect, so exposing them here would invite an accidental drain of `partialObjectStream`.
   */
  readonly completion: Promise<T>;
}
