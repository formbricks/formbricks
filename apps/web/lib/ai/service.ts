import "server-only";
import {
  AIConfigurationError,
  AIOAuthTokenError,
  AIOutputTokenLimitError,
  type AIResolvedLanguageModel,
  type TGenerateObjectOptions,
  type TGenerateObjectResult,
  type TStreamObjectOptions,
  type TStreamObjectResult,
  classifyAIProviderError,
  generateObject,
  generateText,
  isAiConfigured,
  streamObject,
} from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { describeAIError } from "@/lib/ai/loggable-error";
import { env } from "@/lib/env";
import { getOrganization } from "@/lib/organization/service";
import { type AITracingContext, wrapAiModelWithTracing } from "@/lib/posthog/ai-tracing";
import { getIsAISmartToolsEnabled } from "@/modules/ee/license-check/lib/utils";

export const AI_ERROR_CODES = {
  FEATURES_NOT_ENABLED: "ai_features_not_enabled",
  SMART_TOOLS_DISABLED: "ai_smart_tools_disabled",
  INSTANCE_NOT_CONFIGURED: "ai_instance_not_configured",
  QUOTA_EXCEEDED: "ai_quota_exceeded",
} as const;

export type TAIErrorCode = (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES];

export interface TOrganizationAIConfig {
  organizationId: string;
  isAISmartToolsEnabled: boolean;
  isAISmartToolsEntitled: boolean;
  isInstanceConfigured: boolean;
}

export const isInstanceAIConfigured = (): boolean => isAiConfigured(env);

/**
 * The one place a provider failure is turned into a log line and, for a 429, a typed error. Shared
 * by all three generation paths: they differ only in the log message, and drifting on which fields
 * get logged — or on whether a cancellation is exempt — is exactly how one path ends up paging
 * someone for a user pressing Stop.
 *
 * The error itself is never logged: an AI SDK error carries the prompt and the model's output in its
 * message and fields, so the line records what locates and classifies the failure (`describeAIError`)
 * and the caller still gets the original to branch on. A caller that lets it travel further — to the
 * server action client, which logs and reports a thrown error whole — rethrows `redactAIError(error)`.
 */
// A function declaration, not an arrow const: TypeScript only treats a call as terminating — so the
// catch blocks below need no unreachable `throw` after it — when the callee is declared this way.
function classifyOrganizationAIFailure(
  error: unknown,
  {
    organizationId,
    aiConfig,
    message,
    call,
  }: {
    organizationId: string;
    aiConfig: TOrganizationAIConfig;
    message: string;
    /** The call's own abort signal and timeout, which tell a cancellation from a timeout. */
    call: TAICallControls;
  }
): never {
  // A cancelled generation is the user pressing Stop or closing the tab, not an incident: it must
  // not be logged at error level and it carries no provider status to map.
  if (isCallerAbort(error, call)) throw error;

  // Running out of output budget is a size problem every caller maps to a user-facing message, not a
  // provider incident. Warn with the token counts — they tell a too-large request apart from
  // reasoning tokens eating the budget — instead of an error-level entry.
  if (error instanceof AIOutputTokenLimitError) {
    const { maxOutputTokens, outputTokens, reasoningTokens } = error.details;
    logger.warn(
      { organizationId, maxOutputTokens, outputTokens, reasoningTokens },
      `${message}: output token limit reached`
    );
    throw error;
  }

  const providerError = classifyAIProviderError(error);
  const fields = {
    organizationId,
    isInstanceConfigured: aiConfig.isInstanceConfigured,
    errorCode: getAIErrorCode(error),
    ...(error instanceof AIConfigurationError ? { configuration: getConfigurationDetails(error) } : {}),
    statusCode: providerError?.statusCode,
    isQuotaExhausted: providerError?.isQuotaExhausted,
    isRetryable: providerError?.isRetryable,
    isAuthFailure: providerError?.isAuthFailure,
    ...describeAIError(error),
  };
  // A call that ran out of the time its caller gave it (`timeout`) is a path every caller handles —
  // the QSF import splits the chunk and carries on — so it warns, with the same fields. An abort that
  // is not the caller's (see `isCallerAbort`) is that timeout firing during the SDK's retry backoff.
  if (isTimeoutError(error) || isAbortError(error)) logger.warn(fields, message);
  else logger.error(fields, message);

  if (providerError?.isQuotaExhausted) {
    throw new TooManyRequestsError(AI_ERROR_CODES.QUOTA_EXCEEDED, providerError.retryAfterSeconds);
  }

  throw error;
}

/**
 * The fixed code of one of `@formbricks/ai`'s own errors — a closed vocabulary, unlike a message.
 */
const getAIErrorCode = (error: unknown): string | undefined => {
  if (error instanceof AIConfigurationError || error instanceof AIOAuthTokenError) return error.code;
  return undefined;
};

/**
 * Which part of the instance's AI configuration is wrong: the provider and model it names and the
 * environment fields that are missing or invalid — names, never values.
 */
const getConfigurationDetails = ({ details }: AIConfigurationError) => ({
  provider: details.provider,
  model: details.model,
  missingFields: details.missingFields,
  invalidFields: details.invalidFields,
});

/**
 * A cancelled generation, as it reaches us: the fetch the provider is holding rejects with an
 * `AbortError`, and the SDK sometimes hands it back wrapped one level down as the `cause`.
 */
const isAbortError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError") return true;

  return error.cause instanceof Error && error.cause.name === "AbortError";
};

interface TAICallControls {
  abortSignal?: AbortSignal;
  timeout?: unknown;
}

/**
 * Whether an abort is the caller's: its signal fired, or it set no `timeout` that could have aborted
 * the call instead. With a timeout set and the signal untouched, an `AbortError` is that timeout
 * firing while the AI SDK waited to retry ("Delay was aborted") — a provider failing until the call
 * ran out of time, which has to reach the logs.
 */
const isCallerAbort = (error: unknown, call: TAICallControls): boolean =>
  isAbortError(error) && (call.abortSignal?.aborted === true || call.timeout === undefined);

/** The AI SDK's own `timeout` firing: a `TimeoutError`, sometimes wrapped one level down as the `cause`. */
const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "TimeoutError" || (error.cause instanceof Error && error.cause.name === "TimeoutError"));

export const getOrganizationAIConfig = async (organizationId: string): Promise<TOrganizationAIConfig> => {
  const organization = await getOrganization(organizationId);

  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isAISmartToolsEntitled = await getIsAISmartToolsEnabled(organizationId);

  return {
    organizationId,
    isAISmartToolsEnabled: organization.isAISmartToolsEnabled,
    isAISmartToolsEntitled,
    isInstanceConfigured: isInstanceAIConfigured(),
  };
};

export type TAIUnavailableReason = "not_in_plan" | "not_enabled" | "instance_not_configured" | "read_only";

export const getAISmartToolsUnavailableReason = (
  aiConfig: TOrganizationAIConfig
): TAIUnavailableReason | undefined => {
  if (!aiConfig.isAISmartToolsEntitled) return "not_in_plan";
  if (!aiConfig.isAISmartToolsEnabled) return "not_enabled";
  if (!aiConfig.isInstanceConfigured) return "instance_not_configured";
  return undefined;
};

export const assertOrganizationAIConfigured = async (
  organizationId: string
): Promise<TOrganizationAIConfig> => {
  const aiConfig = await getOrganizationAIConfig(organizationId);

  if (!aiConfig.isAISmartToolsEntitled) {
    throw new OperationNotAllowedError(AI_ERROR_CODES.FEATURES_NOT_ENABLED);
  }

  if (!aiConfig.isAISmartToolsEnabled) {
    throw new OperationNotAllowedError(AI_ERROR_CODES.SMART_TOOLS_DISABLED);
  }

  if (!aiConfig.isInstanceConfigured) {
    throw new OperationNotAllowedError(AI_ERROR_CODES.INSTANCE_NOT_CONFIGURED);
  }

  return aiConfig;
};

type TGenerateOrganizationAITextInput = {
  organizationId: string;
  aiTracing?: Omit<AITracingContext, "organizationId">;
} & Parameters<typeof generateText>[0];

export const generateOrganizationAIText = async ({
  organizationId,
  aiTracing,
  ...options
}: TGenerateOrganizationAITextInput): Promise<Awaited<ReturnType<typeof generateText>>> => {
  const aiConfig = await assertOrganizationAIConfigured(organizationId);

  const wrapModel = aiTracing
    ? (model: AIResolvedLanguageModel) => wrapAiModelWithTracing(model, { organizationId, ...aiTracing })
    : undefined;

  try {
    return await generateText(options, env, wrapModel);
  } catch (error) {
    classifyOrganizationAIFailure(error, {
      organizationId,
      aiConfig,
      message: "Failed to generate organization AI text",
      call: options,
    });
  }
};

type TGenerateOrganizationAIObjectInput<T = unknown> = {
  organizationId: string;
  aiTracing?: Omit<AITracingContext, "organizationId">;
} & TGenerateObjectOptions<T>;

export const generateOrganizationAIObject = async <T = unknown>({
  organizationId,
  aiTracing,
  ...options
}: TGenerateOrganizationAIObjectInput<T>): Promise<TGenerateObjectResult<T>> => {
  const aiConfig = await assertOrganizationAIConfigured(organizationId);

  const wrapModel = aiTracing
    ? (model: AIResolvedLanguageModel) => wrapAiModelWithTracing(model, { organizationId, ...aiTracing })
    : undefined;

  try {
    return await generateObject<T>(options, env, wrapModel);
  } catch (error) {
    classifyOrganizationAIFailure(error, {
      organizationId,
      aiConfig,
      message: "Failed to generate organization AI object",
      call: options,
    });
  }
};

type TStreamOrganizationAIObjectInput<T = unknown> = {
  organizationId: string;
  aiTracing?: Omit<AITracingContext, "organizationId">;
} & TStreamObjectOptions<T>;

/**
 * Streaming counterpart to `generateOrganizationAIObject`, with the same entitlement, tracing and
 * quota-classification contract.
 *
 * Note the two catch surfaces. `streamObject` returns before the provider has been called, so the
 * try/catch below only ever sees the synchronous `AIConfigurationError` from model resolution;
 * everything the blocking sibling's catch handles — provider failures, 429s — arrives later on
 * `completion` and needs its own handler. Collapsing these into one means the quota mapping never
 * fires for a streamed generation.
 */
export const streamOrganizationAIObject = async <T = unknown>({
  organizationId,
  aiTracing,
  ...options
}: TStreamOrganizationAIObjectInput<T>): Promise<TStreamObjectResult<T>> => {
  const aiConfig = await assertOrganizationAIConfigured(organizationId);

  const wrapModel = aiTracing
    ? (model: AIResolvedLanguageModel) => wrapAiModelWithTracing(model, { organizationId, ...aiTracing })
    : undefined;

  const classify = (error: unknown): never =>
    classifyOrganizationAIFailure(error, {
      organizationId,
      aiConfig,
      message: "Failed to stream organization AI object",
      call: options,
    });

  try {
    const result = streamObject<T>(options, env, wrapModel);
    const completion = result.completion.catch(classify);
    // The caller may only consume the partial stream (client aborted); keep the classified
    // rejection from surfacing as an unhandled one.
    completion.catch(() => undefined);

    // Enumerated rather than spread: a future lazy getter on the result would be evaluated by a
    // spread, draining the base stream as a side effect.
    return { partialObjectStream: result.partialObjectStream, completion };
  } catch (error) {
    return classify(error);
  }
};
