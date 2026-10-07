import { AISDKError, NoObjectGeneratedError, RetryError } from "ai";
import { AIOAuthTokenError, classifyAIProviderError } from "@formbricks/ai";
import { type TLoggableError, loggableError, stackFrames } from "@/lib/utils/loggable-error";

/**
 * What an AI failure may put in a log line or an error report. Never a message and never a field the AI
 * SDK fills from the call: its errors carry the prompt (`APICallError.requestBodyValues`, and every
 * attempt of a `RetryError` again), the model's output (`NoObjectGeneratedError.text`,
 * `TypeValidationError.value`, `JSONParseError.text`, and the messages built from them) and the provider's
 * raw answer (`responseBody`). pino's `err` serializer writes all of that, causes and nested errors
 * included, and Sentry reports the message of the error and of every cause.
 */

/** Far enough for any chain the SDK builds (RetryError → APICallError → fetch failure); a cycle stops here. */
const MAX_CAUSE_DEPTH = 5;

/** `describeAIError`'s fields: a name, frames and the SDK's own enumerated diagnostics. */
export type TAIErrorDescription = TLoggableError & {
  /**
   * The names of the errors under `cause`, outermost first — what tells a schema mismatch
   * (`AI_TypeValidationError`) from unparseable output (`AI_JSONParseError`) under an
   * `AI_NoObjectGeneratedError`. A cause that is not an `Error` is recorded by its type.
   */
  errCauseNames?: string[];
  /** Why the SDK stopped retrying: `maxRetriesExceeded`, `errorNotRetryable` or `abort`. */
  retryReason?: string;
  /** How many attempts the SDK made before giving up. */
  retryAttempts?: number;
  lastErrName?: string;
  /** The code of a token-endpoint failure on the last attempt — a fixed vocabulary, never a message. */
  lastErrCode?: string;
  /** Why the model stopped, when it produced no usable object: `length`, `content-filter`, … */
  finishReason?: string;
};

/** `describeAIError` plus the provider's HTTP status, for logs that do not carry it already. */
export type TLoggableAIError = TAIErrorDescription & { providerStatusCode?: number };

const nameOf = (value: unknown): string => {
  if (!(value instanceof Error)) return typeof value;
  return typeof value.name === "string" ? value.name : typeof value.name;
};

const causeNames = (error: Error): string[] => {
  const names: string[] = [];
  let cause: unknown = error.cause;
  while (cause !== undefined && names.length < MAX_CAUSE_DEPTH) {
    names.push(nameOf(cause));
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return names;
};

const retryDetails = (error: unknown): Partial<TAIErrorDescription> => {
  if (!RetryError.isInstance(error)) return {};

  const { lastError } = error;
  return {
    retryReason: error.reason,
    retryAttempts: error.errors.length,
    lastErrName: nameOf(lastError),
    ...(lastError instanceof AIOAuthTokenError ? { lastErrCode: lastError.code } : {}),
  };
};

/**
 * Name, frames, cause names and the SDK's enumerated diagnostics of an AI failure — for a log line that
 * records the provider status under a key of its own.
 */
export const describeAIError = (error: unknown): TAIErrorDescription => {
  if (!(error instanceof Error)) {
    return loggableError(error);
  }

  const causes = causeNames(error);
  const finishReason = NoObjectGeneratedError.isInstance(error) ? error.finishReason : undefined;
  return {
    ...loggableError(error),
    ...(causes.length > 0 ? { errCauseNames: causes } : {}),
    ...retryDetails(error),
    ...(typeof finishReason === "string" ? { finishReason } : {}),
  };
};

/**
 * The provider's HTTP status for a failure, read from the first link of its `cause` chain that carries
 * one. `classifyAIProviderError` reads only the error it is given, so an app error wrapping an
 * `APICallError` would otherwise report no status at all. Bounded, so a cause cycle stops.
 */
const providerStatusCodeOf = (error: unknown): number | undefined => {
  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth += 1) {
    const statusCode = classifyAIProviderError(current)?.statusCode;
    if (statusCode !== undefined) return statusCode;
    if (!(current instanceof Error)) return undefined;
    current = current.cause;
  }
  return undefined;
};

/** `describeAIError` plus the provider's HTTP status: everything an AI failure may log. */
export const loggableAIError = (error: unknown): TLoggableAIError => {
  const providerStatusCode = providerStatusCodeOf(error);
  return {
    ...describeAIError(error),
    ...(providerStatusCode === undefined ? {} : { providerStatusCode }),
  };
};

/** Whether an error is an AI SDK error, or wraps one somewhere down its `cause` chain. */
export const isAISDKErrorChain = (error: unknown): boolean => {
  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth += 1) {
    if (AISDKError.isInstance(current)) return true;
    if (!(current instanceof Error)) return false;
    current = current.cause;
  }
  return false;
};

/**
 * Stands in for an AI SDK error on its way to a sink that logs or reports errors whole — the server
 * action client's `handleServerError` writes a thrown error to pino and to Sentry as it is. It keeps
 * what locates the failure — the original name (or, for something thrown that is not an `Error`, its
 * type), the provider status found anywhere down the `cause` chain, and the original frames under a
 * header of its own — and nothing the call filled in: no message, no fields, no `cause`.
 */
export class RedactedAIError extends Error {
  readonly originalName: string;
  readonly providerStatusCode?: number;

  constructor(original: unknown) {
    const originalName = nameOf(original);
    const providerStatusCode = providerStatusCodeOf(original);
    super(
      `AI call failed with ${originalName}${
        providerStatusCode === undefined ? "" : ` (provider status ${providerStatusCode})`
      }; its message is withheld because it can carry the prompt or the model's output`
    );
    this.name = "RedactedAIError";
    this.originalName = originalName;
    if (providerStatusCode !== undefined) {
      this.providerStatusCode = providerStatusCode;
    }

    // The original's frames under this error's own header, so a report still points at the failing call
    // rather than at the line that redacted it. Without readable frames, this error's own stack stands.
    const frames = original instanceof Error ? stackFrames(original) : [];
    if (frames.length > 0) {
      this.stack = [`${this.name}: ${this.message}`, ...frames].join("\n");
    }
  }
}

/**
 * The error to rethrow past code that may log or report it whole. Fails closed: an AI SDK error (or an
 * error wrapping one) and anything thrown that is not an `Error` at all — a provider's streamed error
 * can be a plain object holding its own message — become a `RedactedAIError`. Only the app's own
 * `Error`s pass through unchanged: they carry no prompt, and callers still branch on them. Log the
 * original with `loggableAIError` first if it is worth a line of its own; the redacted error cannot be
 * turned back.
 */
export const redactAIError = (error: unknown): unknown =>
  !(error instanceof Error) || isAISDKErrorChain(error) ? new RedactedAIError(error) : error;
