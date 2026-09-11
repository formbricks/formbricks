import { z } from "zod";

export const INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE = "ERR_INVALID_PASSWORD_RESET_TOKEN";

/**
 * Stable marker returned while authorization-source mutations are paused for an AuthZed cutover.
 * Keep this value independent from human-readable database or transport messages: callers use it to
 * decide whether a failed mutation is safe to retry.
 */
export const AUTHZED_MUTATIONS_FENCED_ERROR_CODE = "authzed_mutations_fenced" as const;

/** A short retry hint for transports that support `Retry-After`. */
export const AUTHZED_MUTATIONS_FENCED_RETRY_AFTER_SECONDS = 5;

const POSTGRES_RAISE_EXCEPTION_CODE = "P0001";
const PRISMA_RAW_QUERY_ERROR_CODE = "P2010";
const MAX_ERROR_TRAVERSAL_DEPTH = 6;
const MAX_ERROR_TRAVERSAL_NODES = 32;
const NESTED_ERROR_KEYS = ["cause", "error", "errors", "meta", "driverAdapterError"] as const;

type TUnknownRecord = Record<PropertyKey, unknown>;

const isRecord = (value: unknown): value is TUnknownRecord => typeof value === "object" && value !== null;

/** Read only own data properties so a hostile error object's getter cannot run during classification. */
const readOwnProperty = (value: TUnknownRecord, key: PropertyKey): unknown => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
};

const readOwnString = (value: TUnknownRecord, key: PropertyKey): string | undefined => {
  const property = readOwnProperty(value, key);
  return typeof property === "string" ? property : undefined;
};

const isTypedAuthzedMutationsFencedError = (value: unknown): boolean => {
  try {
    return value instanceof AuthzedMutationsFencedError;
  } catch {
    return false;
  }
};

const isExactSanitizedFenceMarker = (value: unknown): boolean => {
  if (value === AUTHZED_MUTATIONS_FENCED_ERROR_CODE) return true;
  if (!isRecord(value)) return false;

  const code = readOwnString(value, "code");
  if (code === AUTHZED_MUTATIONS_FENCED_ERROR_CODE) return true;

  return code === undefined && readOwnString(value, "message") === AUTHZED_MUTATIONS_FENCED_ERROR_CODE;
};

const isRawPostgresFenceError = (value: unknown): boolean =>
  isRecord(value) &&
  readOwnString(value, "code") === POSTGRES_RAISE_EXCEPTION_CODE &&
  readOwnString(value, "message") === AUTHZED_MUTATIONS_FENCED_ERROR_CODE;

const hasPrismaDriverAdapterFenceCause = (value: TUnknownRecord): boolean => {
  const meta = readOwnProperty(value, "meta");
  if (!isRecord(meta)) return false;

  const driverAdapterError = readOwnProperty(meta, "driverAdapterError");
  if (!isRecord(driverAdapterError)) return false;

  const cause = readOwnProperty(driverAdapterError, "cause");
  if (!isRecord(cause)) return false;

  return (
    readOwnString(cause, "originalCode") === POSTGRES_RAISE_EXCEPTION_CODE &&
    readOwnString(cause, "originalMessage") === AUTHZED_MUTATIONS_FENCED_ERROR_CODE
  );
};

const isPrismaFenceError = (value: unknown): boolean =>
  isRecord(value) &&
  readOwnString(value, "code") === PRISMA_RAW_QUERY_ERROR_CODE &&
  hasPrismaDriverAdapterFenceCause(value);

export class AuthzedMutationsFencedError extends Error {
  readonly code = AUTHZED_MUTATIONS_FENCED_ERROR_CODE;
  readonly retryable = true;
  readonly retryAfter = AUTHZED_MUTATIONS_FENCED_RETRY_AFTER_SECONDS;
  readonly statusCode = 503;

  constructor() {
    super(AUTHZED_MUTATIONS_FENCED_ERROR_CODE);
    this.name = "AuthzedMutationsFencedError";
  }
}

/**
 * Structurally recognizes the driver error across Prisma/adapter and HMR module boundaries.
 * Traversal is deliberately narrow and bounded: errors can contain cycles, large metadata objects,
 * proxies, or getters, none of which may turn classification into another operational failure.
 */
export const isAuthzedMutationsFencedError = (error: unknown): boolean => {
  const queue: Array<Readonly<{ depth: number; value: unknown }>> = [{ depth: 0, value: error }];
  const visited = new WeakSet<object>();
  let visitedNodes = 0;

  const enqueue = (value: unknown, depth: number): boolean => {
    if (visitedNodes + queue.length >= MAX_ERROR_TRAVERSAL_NODES) return false;
    queue.push({ depth, value });
    return true;
  };

  while (queue.length > 0 && visitedNodes < MAX_ERROR_TRAVERSAL_NODES) {
    const current = queue.shift();
    if (!current) break;
    visitedNodes += 1;

    if (
      isTypedAuthzedMutationsFencedError(current.value) ||
      isExactSanitizedFenceMarker(current.value) ||
      isRawPostgresFenceError(current.value) ||
      isPrismaFenceError(current.value)
    ) {
      return true;
    }

    if (!isRecord(current.value) || current.depth >= MAX_ERROR_TRAVERSAL_DEPTH) continue;
    if (visited.has(current.value)) continue;
    visited.add(current.value);

    for (const key of NESTED_ERROR_KEYS) {
      const nested = readOwnProperty(current.value, key);
      if (Array.isArray(nested)) {
        for (const item of nested) {
          if (!enqueue(item, current.depth + 1)) break;
        }
      } else if (nested !== undefined) {
        enqueue(nested, current.depth + 1);
      }
    }
  }

  return false;
};

/** Returns a fresh, cause-free error safe to pass across application boundaries. */
export const normalizeAuthzedMutationsFencedError = (error: unknown): AuthzedMutationsFencedError | null =>
  isAuthzedMutationsFencedError(error) ? new AuthzedMutationsFencedError() : null;

class ResourceNotFoundError extends Error {
  statusCode = 404;
  resourceId: string | null;
  resourceType: string;

  constructor(resource: string, id: string | null) {
    super(id ? `${resource} with ID ${id} not found` : `${resource} not found`);
    this.name = "ResourceNotFoundError";
    this.resourceType = resource;
    this.resourceId = id;
  }
}

class InvalidInputError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

class ValidationError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class QueryExecutionError extends Error {
  statusCode = 500;
  constructor(message: string) {
    super(message);
    this.name = "QueryExecutionError";
  }
}

class UnknownError extends Error {
  statusCode = 500;
  constructor(message: string) {
    super(message);
    this.name = "UnknownError";
  }
}

class DatabaseError extends Error {
  statusCode = 500;
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

class UniqueConstraintError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "UniqueConstraintError";
  }
}

class ForeignKeyConstraintError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "ForeignKeyConstraintError";
  }
}

class OperationNotAllowedError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "OperationNotAllowedError";
  }
}

class AuthenticationError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

class AuthorizationError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

class TooManyRequestsError extends Error {
  statusCode = 429;
  retryAfter?: number;
  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = "TooManyRequestsError";
    this.retryAfter = retryAfter;
  }
}

class InvalidPasswordResetTokenError extends Error {
  statusCode = 400;
  code: string;
  reason?: string;
  userId?: string;
  constructor(code = INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE, reason?: string, userId?: string) {
    super(code);
    this.name = "InvalidPasswordResetTokenError";
    this.code = code;
    this.reason = reason;
    this.userId = userId;
  }
}

interface NetworkError {
  code: "network_error";
  message: string;
  status: number;
  url: URL;
  responseMessage?: string;
  details?: Record<string, string | string[] | number | number[] | boolean | boolean[]>;
}

interface ForbiddenError {
  code: "forbidden";
  message: string;
  status: number;
  url: URL;
  responseMessage?: string;
  details?: Record<string, string | string[] | number | number[] | boolean | boolean[]>;
}

export const ZErrorHandler = z.function({ input: [z.any()], output: z.void() });

export {
  ResourceNotFoundError,
  InvalidInputError,
  ValidationError,
  QueryExecutionError,
  DatabaseError,
  UniqueConstraintError,
  UnknownError,
  ForeignKeyConstraintError,
  OperationNotAllowedError,
  AuthenticationError,
  AuthorizationError,
  TooManyRequestsError,
  InvalidPasswordResetTokenError,
};
export type { NetworkError, ForbiddenError };

export const FILE_UPLOAD_ERROR_NAMES = {
  INVALID_FILE_NAME: "InvalidFileNameError",
  STORAGE_NOT_CONFIGURED: "StorageNotConfiguredError",
  STORAGE_UPLOAD_FAILED: "StorageUploadFailedError",
  FILE_TOO_LARGE: "FileTooLargeError",
} as const;

/**
 * Error names that represent expected business-logic failures.
 * These are handled gracefully in the UI and should NOT be reported to Sentry.
 */
export const EXPECTED_ERROR_NAMES = new Set([
  "ResourceNotFoundError",
  "AuthorizationError",
  "InvalidInputError",
  "ValidationError",
  "QueryExecutionError",
  "AuthenticationError",
  "OperationNotAllowedError",
  "TooManyRequestsError",
  "InvalidPasswordResetTokenError",
  "UniqueConstraintError",
  "RequestBodyTooLargeError",
]);

/**
 * Check whether an error is an expected business-logic failure.
 * Works with both error instances and serialised errors (where only `name` survives).
 */
export const isExpectedError = (error: Error): boolean => EXPECTED_ERROR_NAMES.has(error.name);

/**
 * Stable, locale-independent marker placed in an ApiErrorResponse's `details.code` when a
 * response update is rejected because the response was already finalized. Clients key off this
 * instead of the human-readable (and potentially localized/reworded) error message.
 */
export const RESPONSE_ALREADY_FINISHED_ERROR_CODE = "response_already_finished";

/**
 * Stable, locale-independent marker used when a Formbricks Cloud sign-up is rejected because the
 * email uses a personal/free/disposable domain. Reused as the sign-up action's `serverError`
 * sentinel and as the `?error=` code on the SSO rejection redirect, so the client can map it to a
 * localized message without depending on the (server-only) blocklist utility.
 */
export const SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE = "email_domain_not_allowed";

/**
 * Stable, locale-independent marker used when a password is rejected because it appears in the
 * Have-I-Been-Pwned breach corpus (ENG-1587). Set as the `code` on the Better Auth APIError thrown
 * by the breach-check plugin, then re-surfaced as the sign-up / reset action's `serverError`
 * sentinel so the client can map it to a localized message.
 */
export const PASSWORD_COMPROMISED_ERROR_CODE = "password_compromised";

/**
 * Stable, locale-independent marker used when a sign-up presents an invite token that is malformed,
 * expired, or issued to a different email address than the account being created.
 */
export const INVITE_TOKEN_INVALID_ERROR_CODE = "invite_token_invalid";

/**
 * Stable, locale-independent marker used when a sign-up is rejected because the instance has public
 * sign-up closed (`SIGNUP_DISABLED`, or multi-org disabled) and the caller presented neither a valid
 * invite nor a fresh instance to bootstrap.
 */
export const SIGNUP_DISABLED_ERROR_CODE = "signup_disabled";

export interface ApiErrorResponse {
  code:
    | "not_found"
    | "gone"
    | "bad_request"
    | "internal_server_error"
    | "unauthorized"
    | "method_not_allowed"
    | "not_authenticated"
    | "forbidden"
    | "network_error"
    | "too_many_requests";
  message: string;
  status: number;
  url?: URL;
  details?: Record<string, string | string[] | number | number[] | boolean | boolean[]>;
  responseMessage?: string;
}

/**
 * Error types for UI display
 */
export type ClientErrorType = "rate_limit" | "general";

export interface ClientErrorData {
  /** Error type to determine which translations to use */
  type: ClientErrorType;
  /** Whether to show action buttons */
  showButtons?: boolean;
}

/**
 * Helper function to get error data from any error for UI display
 */
export const getClientErrorData = (error: Error): ClientErrorData => {
  // Check by error name as fallback (in case instanceof fails due to module loading issues)
  if (error.name === "TooManyRequestsError") {
    return {
      type: "rate_limit",
      showButtons: false,
    };
  }

  // Default to general error for any other error
  return {
    type: "general",
    showButtons: true,
  };
};
