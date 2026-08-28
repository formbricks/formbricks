import "server-only";
import {
  AIConfigurationError,
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
 * A cancelled generation, as it reaches us: the fetch the provider is holding rejects with an
 * `AbortError`, and the SDK sometimes hands it back wrapped one level down as the `cause`.
 */
const isAbortError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError") return true;

  return error.cause instanceof Error && error.cause.name === "AbortError";
};

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
    const providerError = classifyAIProviderError(error);
    logger.error(
      {
        organizationId,
        isInstanceConfigured: aiConfig.isInstanceConfigured,
        errorCode: error instanceof AIConfigurationError ? error.code : undefined,
        statusCode: providerError?.statusCode,
        isQuotaExhausted: providerError?.isQuotaExhausted,
        isRetryable: providerError?.isRetryable,
        err: error,
      },
      "Failed to generate organization AI text"
    );
    if (providerError?.isQuotaExhausted) {
      throw new TooManyRequestsError(AI_ERROR_CODES.QUOTA_EXCEEDED, providerError.retryAfterSeconds);
    }
    throw error;
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
    const providerError = classifyAIProviderError(error);
    logger.error(
      {
        organizationId,
        isInstanceConfigured: aiConfig.isInstanceConfigured,
        errorCode: error instanceof AIConfigurationError ? error.code : undefined,
        statusCode: providerError?.statusCode,
        isQuotaExhausted: providerError?.isQuotaExhausted,
        isRetryable: providerError?.isRetryable,
        err: error,
      },
      "Failed to generate organization AI object"
    );
    if (providerError?.isQuotaExhausted) {
      throw new TooManyRequestsError(AI_ERROR_CODES.QUOTA_EXCEEDED, providerError.retryAfterSeconds);
    }
    throw error;
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

  const classify = (error: unknown): never => {
    // A cancelled generation is the user pressing Stop or closing the tab, not an incident: it must
    // not be logged at error level (it pages someone) and it carries no provider status to map.
    if (isAbortError(error)) throw error;

    const providerError = classifyAIProviderError(error);
    logger.error(
      {
        organizationId,
        isInstanceConfigured: aiConfig.isInstanceConfigured,
        errorCode: error instanceof AIConfigurationError ? error.code : undefined,
        statusCode: providerError?.statusCode,
        isQuotaExhausted: providerError?.isQuotaExhausted,
        isRetryable: providerError?.isRetryable,
        err: error,
      },
      "Failed to stream organization AI object"
    );
    if (providerError?.isQuotaExhausted) {
      throw new TooManyRequestsError(AI_ERROR_CODES.QUOTA_EXCEEDED, providerError.retryAfterSeconds);
    }
    throw error;
  };

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
