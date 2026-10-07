import { AIOutputTokenLimitError, classifyAIProviderError } from "@formbricks/ai";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { loggableError } from "./loggable-error";

/** Mid-stream AI failures every AI-backed stream reports the same way. Each route words its own detail. */
export const AI_STREAM_FAILURE_CODES = {
  QUOTA_EXCEEDED: "ai_quota_exceeded",
  AUTH_FAILED: "ai_provider_auth_failed",
  OUTPUT_TOO_LONG: "ai_output_too_long",
} as const;

export type TAIStreamFailure =
  | { code: typeof AI_STREAM_FAILURE_CODES.QUOTA_EXCEEDED; retryAfter?: number }
  | { code: typeof AI_STREAM_FAILURE_CODES.AUTH_FAILED }
  | { code: typeof AI_STREAM_FAILURE_CODES.OUTPUT_TOO_LONG };

/**
 * Classify a failure raised by the AI call after the stream opened, or return null for anything that
 * is not an AI failure. Only codes and `Retry-After` come out of it — never the error's message, which
 * a provider can fill with fragments of the prompt.
 */
export function classifyAIStreamFailure(error: unknown): TAIStreamFailure | null {
  if (error instanceof TooManyRequestsError) {
    return { code: AI_STREAM_FAILURE_CODES.QUOTA_EXCEEDED, retryAfter: error.retryAfter };
  }

  if (classifyAIProviderError(error)?.isAuthFailure) {
    return { code: AI_STREAM_FAILURE_CODES.AUTH_FAILED };
  }

  if (error instanceof AIOutputTokenLimitError) {
    return { code: AI_STREAM_FAILURE_CODES.OUTPUT_TOO_LONG };
  }

  return null;
}

/**
 * Whether a failure is the client hanging up rather than a real problem.
 *
 * Checked *before* classification, and the signal of record is the request signal rather than the
 * error: on abort the AI SDK rejects with a DOMException whose shape varies by runtime, while
 * `signal.aborted` is unambiguous. Getting this order wrong logs every user pressing Stop as a failure.
 */
export function isClientAbort(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;

  return error instanceof Error && error.name === "AbortError";
}

/**
 * What an AI stream's failure may put in the log: `loggableError`'s name and frames, plus the provider's
 * status. Never a message: the AI SDK's errors keep the prompt or the model's output in their message
 * and fields (`NoObjectGeneratedError.text`, `TypeValidationError.value`), and pino's error serializer
 * would log all of it.
 */
export function loggableAIError(error: unknown): Record<string, unknown> {
  const providerStatusCode = error instanceof Error ? classifyAIProviderError(error)?.statusCode : undefined;
  return {
    ...loggableError(error),
    ...(providerStatusCode === undefined ? {} : { providerStatusCode }),
  };
}
