import { z } from "zod";

export const INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE = "ERR_INVALID_PASSWORD_RESET_TOKEN";

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
