export interface LoggableStorageError {
  name?: string;
  code?: string;
  httpStatusCode?: number;
  requestId?: string;
  attempts?: number;
  message?: string;
}

// Provider error codes are identifiers ("AccessDenied", "SlowDown"). Anything else is replaced, so a
// provider can't put free text into a log through the code either.
const ERROR_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9.]{0,63}$/;
export const UNKNOWN_SERVICE_ERROR = "UnknownServiceError";

export const toLoggableErrorCode = (code: unknown): string =>
  typeof code === "string" && ERROR_CODE_PATTERN.test(code) ? code : UNKNOWN_SERVICE_ERROR;

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const asNumber = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

/**
 * The part of a storage failure that is safe to log.
 *
 * Never log the raw error: the AWS SDK copies every field of the provider's error response onto the
 * exception, and S3-compatible stores (MinIO, RustFS) return the object's `Key` and `Resource` there.
 * An object key ends with the file name a respondent chose, which can be personal data (ENG-3721).
 * pino would serialize those fields as they are.
 *
 * - **A response came back** (`$metadata.httpStatusCode` is set): keep the error code, status and
 *   request id, enough to look the request up with the provider. The message is the provider's text
 *   (or, for a response the SDK couldn't parse, an echo of its body), so it is dropped.
 * - **No response** (connection refused, DNS, TLS, timeout, configuration): the error was raised
 *   locally and never holds a key, so its message and Node error code are kept. The SDK's retry
 *   middleware adds `$metadata` to these too, which is why the test is the status, not `$metadata`.
 */
export const toLoggableStorageError = (error: unknown): LoggableStorageError => {
  if (typeof error !== "object" || error === null) return { name: typeof error };

  const { name, message, code, $metadata } = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    $metadata?: { httpStatusCode?: unknown; requestId?: unknown; attempts?: unknown };
  };
  const httpStatusCode = asNumber($metadata?.httpStatusCode);
  const attempts = asNumber($metadata?.attempts);

  if (httpStatusCode === undefined) {
    return { name: asString(name), code: asString(code), attempts, message: asString(message) };
  }

  return {
    name: toLoggableErrorCode(name),
    httpStatusCode,
    requestId: asString($metadata?.requestId),
    attempts,
  };
};

/**
 * A partial bulk delete's failures, counted by code. Never the per-object `Key` (it ends with the
 * uploader's file name) or `Message` (the provider's text).
 */
export const countErrorCodes = (errors: readonly { Code?: string }[]): Record<string, number> => {
  const counts = new Map<string, number>();
  for (const { Code } of errors) {
    const code = toLoggableErrorCode(Code);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
};
