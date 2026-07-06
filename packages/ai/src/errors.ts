import { APICallError, RetryError } from "ai";
import type { ActiveAIProvider } from "./types";

export interface AIConfigurationErrorDetails {
  provider?: ActiveAIProvider | null;
  model?: string | null;
  missingFields?: string[];
  invalidFields?: string[];
}

export class AIConfigurationError extends Error {
  code: "providerMissing" | "invalidProvider" | "providerNotConfigured";
  details: AIConfigurationErrorDetails;

  constructor(
    code: "providerMissing" | "invalidProvider" | "providerNotConfigured",
    message: string,
    details: AIConfigurationErrorDetails = {}
  ) {
    super(message);
    this.name = "AIConfigurationError";
    this.code = code;
    this.details = details;
  }
}

export interface AIProviderErrorInfo {
  /** Provider returned HTTP 429 — quota / rate limit exhausted. */
  isQuotaExhausted: boolean;
  /** Whether the underlying call is worth retrying later. */
  isRetryable: boolean;
  statusCode?: number;
  /** Parsed from the provider's `retry-after` response header (seconds), when present. */
  retryAfterSeconds?: number;
}

const parseRetryAfterSeconds = (headers?: Record<string, string>): number | undefined => {
  const raw = headers?.["retry-after"];
  if (!raw) return undefined;
  // RFC 7231 allows either delay-seconds or an HTTP-date.
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isNaN(seconds)) return seconds;
  const retryAt = new Date(raw);
  if (!Number.isNaN(retryAt.getTime())) {
    return Math.max(0, Math.ceil((retryAt.getTime() - Date.now()) / 1000));
  }
  return undefined;
};

const buildInfo = (error: APICallError): AIProviderErrorInfo => {
  const isQuotaExhausted = error.statusCode === 429;
  return {
    isQuotaExhausted,
    // A 429 is always worth retrying later, even if the SDK didn't flag the call retryable.
    isRetryable: isQuotaExhausted || error.isRetryable,
    statusCode: error.statusCode,
    retryAfterSeconds: parseRetryAfterSeconds(error.responseHeaders),
  };
};

/**
 * Classify a thrown AI SDK error into provider-level signals the app can act on — chiefly whether
 * the provider returned a 429 (quota exhausted) so callers can surface a clear, retryable message
 * instead of a silent failure. Returns undefined for errors that aren't provider API/retry errors.
 *
 * Lives here so the `ai` SDK error types stay encapsulated in this package — apps consume the plain
 * `AIProviderErrorInfo` shape without importing the SDK directly.
 */
export const classifyAIProviderError = (error: unknown): AIProviderErrorInfo | undefined => {
  if (APICallError.isInstance(error)) {
    return buildInfo(error);
  }

  // After the SDK exhausts its internal retries it wraps the per-attempt errors in a RetryError;
  // dig out the most recent APICallError to recover the real status code.
  if (RetryError.isInstance(error)) {
    const apiError = [...error.errors, error.lastError]
      .reverse()
      .find((candidate): candidate is APICallError => APICallError.isInstance(candidate));
    if (apiError) {
      return buildInfo(apiError);
    }
    return { isQuotaExhausted: false, isRetryable: error.reason === "maxRetriesExceeded" };
  }

  return undefined;
};
